/**
 * The billing split (Part V) — enforced, not just documented.
 *
 * "Interactive sessions = your Claude subscription. runner = separate API key workspace
 * with hard monthly cap." This file is the hard part of that sentence.
 *
 * The ledger is persisted, because a cap that resets on restart is not a cap — it is a
 * speed bump that a crash loop drives straight through. The number it accumulates is real
 * spend reported by finished sessions, never an estimate.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import type { BudgetStatus } from '@agnetos/contracts';
import { ApiError } from './errors';
import type { RunnerConfig } from './config';

interface LedgerFile {
  /** `YYYY-MM` → dollars spent. Kept per month so history survives the rollover. */
  months: Record<string, number>;
}

const currency = (usd: number): string => `$${usd.toFixed(2)}`;

function nextMonthLabel(period: string): string {
  const [yearRaw, monthRaw] = period.split('-');
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  const date = new Date(Date.UTC(year, month, 1));
  return date.toLocaleString('en-GB', { month: 'long', timeZone: 'UTC' });
}

export class SpendLedger {
  private readonly config: RunnerConfig;
  private readonly file: string;
  private months: Record<string, number> = {};
  private loaded = false;
  /**
   * Has a write to `spend.json` actually succeeded?
   *
   * `null` until one has been attempted — which is honest and is the state on a fresh
   * runner: **durability is untested until the first run finishes.** It is deliberately
   * not probed by writing a zero at boot, because a spend file this process invented is a
   * fabricated number inside a billing control.
   */
  private persisted: boolean | null = null;
  private warnedAboutPersist = false;
  /** Set by the runner so a failed persist reaches the log once, not zero times. */
  onPersistFailure?: (message: string) => void;

  constructor(config: RunnerConfig) {
    this.config = config;
    this.file = join(config.artifactsRoot, '..', 'spend.json');
  }

  static period(now: Date = new Date()): string {
    return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
  }

  private async load(): Promise<void> {
    if (this.loaded) return;
    try {
      const parsed = JSON.parse(await readFile(this.file, 'utf8')) as LedgerFile;
      this.months = parsed.months ?? {};
    } catch {
      this.months = {};
    }
    this.loaded = true;
  }

  private async persist(): Promise<void> {
    try {
      await mkdir(dirname(this.file), { recursive: true });
      await writeFile(this.file, JSON.stringify({ months: this.months }, null, 2), 'utf8');
      this.persisted = true;
    } catch (error) {
      // Losing the file must not fail a run that already succeeded. The in-memory figure
      // still guards the rest of this process's life, and `status()` keeps reporting it.
      //
      // But it must not be *silent*, which it was: when `/workspaces` was root-owned and
      // the runner ran as uid 1001, every write failed, `spend.json` never existed, and
      // `spentUsd` came back `0` after every restart. A cap that resets on restart is not
      // a cap — it is a speed bump a crash loop drives straight through (Part V) — and
      // nothing anywhere said so. `0` meant "nothing spent" and "we cannot remember what
      // was spent" with the same digit.
      this.persisted = false;
      if (!this.warnedAboutPersist) {
        this.warnedAboutPersist = true;
        this.onPersistFailure?.(
          `The runner cannot write its spend ledger to ${this.file} ` +
            `(${error instanceof Error ? error.message : String(error)}). ` +
            'Spending is still counted for this process, but the monthly cap will reset ' +
            'when the runner restarts — so it is not a hard cap until this is fixed.',
        );
      }
    }
  }

  async record(costUsd: number | null): Promise<void> {
    if (costUsd === null || !Number.isFinite(costUsd) || costUsd <= 0) return;
    await this.load();
    const period = SpendLedger.period();
    this.months[period] = (this.months[period] ?? 0) + costUsd;
    await this.persist();
  }

  async status(): Promise<BudgetStatus> {
    await this.load();
    const period = SpendLedger.period();
    const spentUsd = Math.round((this.months[period] ?? 0) * 10000) / 10000;
    const capUsd = this.config.monthlyCapUsd;
    return {
      capUsd,
      spentUsd,
      remainingUsd: capUsd === null ? null : Math.max(0, Math.round((capUsd - spentUsd) * 10000) / 10000),
      blocked: capUsd !== null && spentUsd >= capUsd,
      period,
      // `false` ⇒ `spentUsd` is this process's memory only and the cap is soft.
      // `null` ⇒ no run has finished yet, so durability has not been tested. Both are
      // materially different from `true`, and none of them is visible from `spentUsd`.
      persisted: this.persisted,
    };
  }

  /**
   * Gate called before any session is spawned.
   *
   * Both hints are written for the person who will read them — on a phone, having just
   * pressed Run, wanting to know whether this is their fault and what to press next.
   */
  async assertCanStart(): Promise<void> {
    if (!this.config.configured) {
      throw new ApiError('runner_not_configured', 'The runner has no API key, so it cannot start a run.', {
        hint:
          'Set RUNNER_ANTHROPIC_API_KEY in the repo-root .env to a key from the runner\'s own capped ' +
          'Anthropic workspace — not your personal Claude subscription, which powers interactive ' +
          'sessions instead — then run: docker compose -f infra/compose.yaml --env-file .env ' +
          '--profile obs up -d runner. A REPLACE-ME placeholder counts as no key.',
        retryable: false,
      });
    }

    const budget = await this.status();
    if (!budget.blocked) return;

    throw new ApiError(
      'monthly_cap_reached',
      `The runner's monthly budget of ${currency(budget.capUsd ?? 0)} is spent.`,
      {
        hint: `This month's runner budget (${currency(budget.capUsd ?? 0)}) is spent, so no new runs can start. Raise RUNNER_MONTHLY_CAP_USD in infra/.env and restart the runner, or wait until ${nextMonthLabel(budget.period)}. Your interactive Claude sessions are on a different account and are unaffected.`,
        retryable: false,
      },
    );
  }
}
