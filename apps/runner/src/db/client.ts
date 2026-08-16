/**
 * Postgres connection + migrations.
 *
 * `pg` is imported dynamically so that every pure module under `observability/` and
 * `db/` stays testable with `node --test` and no install step — nothing here is loaded
 * unless someone actually opens a connection.
 *
 * PDPL (Part VII.4): this connects to the compose-local Postgres on the tailnet. The
 * volume stays on our machine and backups are encrypted — see the note to
 * `infra-compose-engineer`. There is no managed-Postgres code path, deliberately.
 */

import { readdir, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { DbClient } from '../observability/types.ts';

const MIGRATIONS_DIR = join(dirname(fileURLToPath(import.meta.url)), 'migrations');

export type PoolHandle = DbClient & {
  end(): Promise<void>;
  /**
   * Lend one pooled connection for the length of `fn`.
   *
   * `pool.query` picks whatever connection is free, which is correct for a single
   * statement and wrong for anything with per-connection state. The project scope
   * (`agnetos.project_id`, migration 0005 §5) is exactly that: setting it through
   * `pool.query` sets it on one connection and then reads from another, which looks like
   * enforcement and is not. `db/scope.ts` is the only caller.
   */
  session<T>(fn: (client: DbClient) => Promise<T>): Promise<T>;
};

export interface ConnectOptions {
  /**
   * Called when an **idle** pooled client dies — a Postgres restart, a failover, an
   * admin `pg_terminate_backend`.
   *
   * This listener is not optional decoration. `pg`'s Pool is an EventEmitter, and an
   * EventEmitter with no `error` listener rethrows: `docker restart postgres` took the
   * whole runner process down with `Unhandled 'error' event: terminating connection due
   * to administrator command`, observed on the running stack. `restart: unless-stopped`
   * then hid it, because the container came back — but a crash-restart loses the
   * in-memory run store, every attached SSE stream and every pending approval with it.
   * A phone watching a run just sees the stream die.
   *
   * `runner-engineer` passes `createLedgerConnection`'s drop handler here, which releases
   * the pool and re-dials with backoff. Filed to `observability-engineer` as an fyi.
   */
  onError?: (error: unknown) => void;
}

export async function connect(
  connectionString = process.env.DATABASE_URL,
  options: ConnectOptions = {},
): Promise<PoolHandle> {
  if (!connectionString) {
    throw new Error('DATABASE_URL is not set. The runner cannot record runs without it.');
  }
  const { Pool } = await import('pg');
  const pool = new Pool({ connectionString, max: 8, idleTimeoutMillis: 30_000 });
  pool.on('error', (error) => {
    options.onError?.(error);
  });
  return {
    query: <R = Record<string, unknown>>(sql: string, params?: readonly unknown[]) =>
      pool.query(sql, params ? [...params] : undefined) as unknown as Promise<{ rows: R[] }>,
    async session<T>(fn: (client: DbClient) => Promise<T>): Promise<T> {
      const client = await pool.connect();
      try {
        return await fn({
          query: <R = Record<string, unknown>>(sql: string, params?: readonly unknown[]) =>
            client.query(sql, params ? [...params] : undefined) as unknown as Promise<{ rows: R[] }>,
        });
      } finally {
        // Release unconditionally. A connection leaked on an error path is a pool that
        // runs out eight requests later, at which point the metrics API stops answering
        // for a reason that has nothing to do with the query that broke.
        client.release();
      }
    },
    end: () => pool.end(),
  };
}

/**
 * Apply pending migrations in filename order. Idempotent: every migration is written
 * with `IF NOT EXISTS` / `CREATE OR REPLACE`, and applied names are recorded so a
 * rerun is a no-op rather than a gamble.
 */
export async function migrate(db: DbClient): Promise<string[]> {
  await db.query(`
    CREATE TABLE IF NOT EXISTS ops_migrations (
      name text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `);

  const { rows } = await db.query<{ name: string }>('SELECT name FROM ops_migrations');
  const applied = new Set(rows.map((r) => r.name));

  const files = (await readdir(MIGRATIONS_DIR)).filter((f) => f.endsWith('.sql')).sort();
  const ran: string[] = [];

  for (const file of files) {
    if (applied.has(file)) continue;
    const sql = await readFile(join(MIGRATIONS_DIR, file), 'utf8');
    await db.query(sql);
    await db.query('INSERT INTO ops_migrations (name) VALUES ($1)', [file]);
    ran.push(file);
  }

  return ran;
}

/** `node apps/runner/src/db/client.ts` applies migrations and exits. */
if (process.argv[1] && import.meta.url === `file://${process.argv[1].replace(/\\/g, '/')}`) {
  const pool = await connect();
  try {
    const ran = await migrate(pool);
    console.log(ran.length ? `Applied: ${ran.join(', ')}` : 'No pending migrations.');
  } finally {
    await pool.end();
  }
}
