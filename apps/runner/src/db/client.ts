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

export type PoolHandle = DbClient & { end(): Promise<void> };

export async function connect(connectionString = process.env.DATABASE_URL): Promise<PoolHandle> {
  if (!connectionString) {
    throw new Error('DATABASE_URL is not set. The runner cannot record runs without it.');
  }
  const { Pool } = await import('pg');
  const pool = new Pool({ connectionString, max: 8, idleTimeoutMillis: 30_000 });
  return {
    query: <R = Record<string, unknown>>(sql: string, params?: readonly unknown[]) =>
      pool.query(sql, params ? [...params] : undefined) as unknown as Promise<{ rows: R[] }>,
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
