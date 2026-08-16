/**
 * The run-ledger connection supervisor.
 *
 * Why this file exists, in the words of the bug it fixes:
 *
 *   The runner probed Postgres exactly once at boot, lost the race against initdb, printed
 *   "observability is not up", and **latched** for the life of the process. The whole stack
 *   reported healthy while `/api/metrics/*` answered 503 and the cost ticker rendered
 *   "no cost data". `infra-compose-engineer` fixed the *ordering* in compose
 *   (`depends_on: postgres: {condition: service_healthy, required: false}`); the *latch* is
 *   runner code, and this is it.
 *
 * Two properties, and the second matters more than the first:
 *
 * 1. **It reconnects.** A `docker restart postgres`, a failover, a blip — the supervisor
 *    notices, backs off, and reattaches. `services.obs` is replaced, never captured.
 *
 * 2. **"Cannot reach the ledger" and "the ledger is empty" are different answers.** A
 *    latched connection failure looked *exactly* like the honest empty state the whole
 *    product is supposed to show when nothing has run yet (BOARD rule 9 / Part VII.3). That
 *    is worse than a visible outage: a broken state wearing an honest state's clothes. So
 *    the state is a first-class value on every response that depends on it, and a count we
 *    do not have is `null` — never `0`.
 *
 * `absent` is not a failure. `--profile dev` has no Postgres by design (M0 #3), which is
 * why the compose `depends_on` carries `required: false`. A runner with no `DATABASE_URL`
 * must serve happily, say so, and never open a retry loop against a database nobody asked
 * for.
 */
import type { LedgerHealth, LedgerState } from '@agnetos/contracts';
import type { RunnerLogger } from './runService.ts';
import { createObservability, type Observability } from '../observability/index.ts';

export type { LedgerHealth, LedgerState };

/** 1s → 30s, then 30s forever. Long enough not to hammer initdb, short enough to feel live. */
const DEFAULT_BACKOFF_MS = [1_000, 2_000, 5_000, 10_000, 20_000, 30_000] as const;

/**
 * Liveness probe interval while connected. Without it, a Postgres that dies during an idle
 * night is only discovered by the first request of the morning — and that request answers
 * "unavailable" from a state that claimed "connected" a moment earlier. One `SELECT 1` per
 * interval buys a status endpoint that is true when nobody is asking.
 */
const DEFAULT_PROBE_MS = 30_000;

/**
 * Postgres SQLSTATE `08***` is connection_exception and `57P0*` is
 * admin_shutdown/crash_shutdown/cannot_connect_now. Anything with a non-SQLSTATE `code`
 * (`ECONNREFUSED`, `ENOTFOUND`, `ETIMEDOUT`, `EPIPE`, `ECONNRESET`) came from the socket,
 * not from the server. Everything else is a query bug and must **not** drop the connection —
 * a bad `make_interval` call is not a reason to declare the database down.
 */
export function isConnectionError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const code = (error as { code?: unknown }).code;
  if (typeof code === 'string') {
    if (/^(08|57P)/.test(code)) return true;
    if (/^E[A-Z]+$/.test(code)) return true;
  }
  const message = error instanceof Error ? error.message : String((error as { message?: unknown }).message ?? '');
  return /terminat|connection|socket|ECONNRE|not answering|shutting down|starting up/i.test(message);
}

export interface LedgerConnectionOptions {
  /**
   * Opens the pool and applies migrations. Injected so the tests exercise the real state
   * machine without a Postgres, which is the only way this file gets tested at all.
   */
  open?: () => Promise<Observability>;
  /**
   * False ⇒ `absent`. Defaults to "is `DATABASE_URL` (or `APP_DATABASE_URL`) set".
   */
  configured?: boolean;
  logger?: RunnerLogger;
  /** Fired on every transition, with the live handle or `undefined`. */
  onChange?: (obs: Observability | undefined) => void;
  backoffMs?: readonly number[];
  /** `0` disables the liveness probe. Tests set this; production should not. */
  probeIntervalMs?: number;
}

const silent: RunnerLogger = { info: () => {}, warn: () => {}, error: () => {} };

function messageOf(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return 'unknown error';
}

function hintFor(state: LedgerState, attempts: number, nextRetryMs: number | null): string {
  if (state === 'connected') {
    return 'The run ledger is connected. Every number on this screen came from it.';
  }
  if (state === 'absent') {
    return (
      'This runner has no run ledger configured (no DATABASE_URL), so there is no history to ' +
      'read. That is normal on the dev profile. Start the stack with --profile obs if you ' +
      'expected runs here. Runs still work; they are just not recorded.'
    );
  }
  const retry = nextRetryMs === null ? 'reconnecting' : `reconnecting in ${Math.round(nextRetryMs / 1000)}s`;
  // `attempts === 0` is the connection that just dropped, before the first re-dial has
  // been made. "0 failed attempts" would read as though nothing had gone wrong.
  const detail = attempts === 0 ? retry : `${attempts} failed attempt${attempts === 1 ? '' : 's'}, ${retry}`;
  return (
    `The run ledger is not answering (${detail}). ` +
    'This is not "no runs yet" — the number you are looking for is unknown, not zero. ' +
    'Runs still work and will be recorded once the database is back.'
  );
}

export interface LedgerConnection {
  /** The live handle, or `undefined`. **Call this per request; never capture the result.** */
  current(): Observability | undefined;
  health(): LedgerHealth;
  /** Report a failed query so the supervisor can drop and re-dial. Ignores query bugs. */
  reportQueryError(error: unknown): void;
  /** Begin connecting. Resolves after the first attempt so boot logs are truthful. */
  start(): Promise<void>;
  close(): Promise<void>;
}

export function createLedgerConnection(options: LedgerConnectionOptions = {}): LedgerConnection {
  const logger = options.logger ?? silent;
  const backoff = options.backoffMs ?? DEFAULT_BACKOFF_MS;
  const probeMs = options.probeIntervalMs ?? DEFAULT_PROBE_MS;
  const configured =
    options.configured ?? Boolean(process.env.DATABASE_URL ?? process.env.APP_DATABASE_URL);
  /**
   * The `onError` hook is how an **idle** pooled client dying reaches us. Without it `pg`
   * rethrows on an EventEmitter with no listener and the runner process exits — which is
   * not "failing to reconnect", it is losing the run store, the live SSE streams and the
   * pending approvals along with it. Observed on the running stack with
   * `docker restart postgres`.
   *
   * The handler is bound to the handle it belongs to. A dead pool goes on emitting after
   * we have replaced it, and an un-scoped handler would let the corpse tear down its own
   * successor — a reconnect loop that never converges.
   */
  const open =
    options.open ??
    (async () => {
      const own: { handle?: Observability } = {};
      own.handle = await createObservability(process.env, (err) => {
        if (own.handle && own.handle === obs) drop(err);
      });
      return own.handle;
    });

  let obs: Observability | undefined;
  let state: LedgerState = configured ? 'unreachable' : 'absent';
  let since = new Date().toISOString();
  let attempts = 0;
  let lastError: string | null = null;
  let nextRetryAt: string | null = null;
  let nextRetryMs: number | null = null;
  let retryTimer: NodeJS.Timeout | null = null;
  let probeTimer: NodeJS.Timeout | null = null;
  let connecting = false;
  let closed = false;

  const setState = (next: LedgerState): void => {
    if (state === next) return;
    state = next;
    since = new Date().toISOString();
  };

  const publish = (handle: Observability | undefined): void => {
    obs = handle;
    options.onChange?.(handle);
  };

  const stopProbe = (): void => {
    if (probeTimer) clearInterval(probeTimer);
    probeTimer = null;
  };

  const startProbe = (): void => {
    stopProbe();
    if (probeMs <= 0) return;
    probeTimer = setInterval(() => {
      const handle = obs;
      if (!handle) return;
      void handle.db.query('SELECT 1').catch((err: unknown) => {
        if (isConnectionError(err)) drop(err);
      });
    }, probeMs);
    probeTimer.unref?.();
  };

  /** Tear down a connection we no longer trust and re-enter the retry loop. */
  const drop = (error: unknown): void => {
    if (closed) return;
    const handle = obs;
    publish(undefined);
    stopProbe();
    if (handle) {
      // Best effort. A pool we already believe is dead must not be able to throw here and
      // take the reconnect loop with it.
      void handle.close().catch(() => {});
    }
    lastError = messageOf(error);
    setState('unreachable');
    logger.warn(
      { err: lastError },
      'run ledger connection lost — reconnecting; metrics report state "unreachable", not an empty result',
    );
    schedule();
  };

  const schedule = (): void => {
    if (closed || state === 'absent' || retryTimer) return;
    const delay = backoff[Math.min(attempts, backoff.length - 1)] ?? backoff[backoff.length - 1] ?? 30_000;
    nextRetryMs = delay;
    nextRetryAt = new Date(Date.now() + delay).toISOString();
    retryTimer = setTimeout(() => {
      retryTimer = null;
      void attempt();
    }, delay);
    retryTimer.unref?.();
  };

  /**
   * Every query goes through here so a connection-class failure re-enters the retry loop
   * *by itself*. Without it the only way back would be a restart — which is precisely the
   * latch this file exists to remove. `handleMetricsRequest` catches its own errors and
   * answers 503, so this wrapper is the runner's only chance to see the failure at all.
   */
  const supervise = (handle: Observability): Observability => {
    const inner = handle.db.query.bind(handle.db);
    handle.db.query = (async (sql: string, params?: readonly unknown[]) => {
      try {
        return await inner(sql, params);
      } catch (err) {
        if (isConnectionError(err)) drop(err);
        throw err;
      }
    }) as typeof handle.db.query;
    return handle;
  };

  const attempt = async (): Promise<void> => {
    if (closed || connecting || state === 'absent' || obs) return;
    connecting = true;
    try {
      const handle = supervise(await open());
      if (closed) {
        await handle.close().catch(() => {});
        return;
      }
      attempts = 0;
      lastError = null;
      nextRetryAt = null;
      nextRetryMs = null;
      setState('connected');
      publish(handle);
      startProbe();
      logger.info({}, 'run ledger connected — LAST RUNS and the cost ticker are live');
    } catch (err) {
      attempts += 1;
      lastError = messageOf(err);
      setState('unreachable');
      logger.warn(
        { err: lastError, attempts },
        'run ledger is not up — runs still work; LAST RUNS and the cost ticker report "unreachable" (not an empty result) until it answers',
      );
      schedule();
    } finally {
      connecting = false;
    }
  };

  return {
    current: () => obs,
    health: () => ({
      state,
      since,
      attempts,
      lastError,
      nextRetryAt,
      hint: hintFor(state, attempts, nextRetryMs),
    }),
    reportQueryError: (error: unknown) => {
      if (isConnectionError(error)) drop(error);
    },
    start: async () => {
      if (state === 'absent') {
        logger.info({}, 'no DATABASE_URL — running without a ledger (dev profile); this is a configuration, not a fault');
        return;
      }
      await attempt();
    },
    close: async () => {
      closed = true;
      if (retryTimer) clearTimeout(retryTimer);
      retryTimer = null;
      stopProbe();
      const handle = obs;
      publish(undefined);
      if (handle) await handle.close().catch(() => {});
    },
  };
}
