/**
 * Cost attribution (§2.0 cost ticker, §2.3 LAST RUNS, §2.5 KPI tiles).
 *
 * Precedence, and this order is the whole point:
 *   1. `usage.costUsd` reported by the Agent SDK  → costSource: 'sdk'
 *   2. tokens × the published list rate below      → costSource: 'derived'
 *   3. null                                        → costSource: 'unpriced'
 *
 * Case 3 is not a failure. Part VII.3 and standing rule 9 say an honest empty state
 * beats a plausible fake one, so an unknown model produces `costUsd: null` and the
 * ticker reports how many runs it could not price. It never invents a rate.
 *
 * Rates are USD per million tokens, from the published Anthropic price list
 * (list rates; a negotiated discount makes the real invoice lower, never higher).
 * `PRICE_TABLE_VERSION` is stamped on every derived row so a rate change is traceable
 * rather than a silent restatement of history.
 */

export const PRICE_TABLE_VERSION = '2026-06-24';

type Rate = {
  /** USD per 1M input tokens. */
  input: number;
  /** USD per 1M output tokens. */
  output: number;
  /** Optional promotional rate, applied only while `until` has not passed. */
  intro?: { input: number; output: number; until: string };
};

const RATES: Record<string, Rate> = {
  'claude-fable-5': { input: 10, output: 50 },
  'claude-mythos-5': { input: 10, output: 50 },
  'claude-opus-5': { input: 5, output: 25 },
  'claude-opus-4-8': { input: 5, output: 25 },
  'claude-opus-4-7': { input: 5, output: 25 },
  'claude-opus-4-6': { input: 5, output: 25 },
  'claude-sonnet-5': {
    input: 3,
    output: 15,
    intro: { input: 2, output: 10, until: '2026-08-31T23:59:59Z' },
  },
  'claude-sonnet-4-6': { input: 3, output: 15 },
  'claude-haiku-4-5': { input: 1, output: 5 },
};

/** Cache reads bill at ~0.1x input; 5-minute cache writes at ~1.25x input. */
const CACHE_READ_MULTIPLIER = 0.1;
const CACHE_WRITE_MULTIPLIER = 1.25;

export type Tokens = {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
};

export type PricedCost = {
  costUsd: number | null;
  costSource: 'sdk' | 'derived' | 'unpriced';
};

function rateFor(model: string, at: Date): Rate | undefined {
  // Tolerate a dated snapshot id (`claude-x-20260101`) by falling back to its alias.
  const rate = RATES[model] ?? RATES[model.replace(/-\d{8}$/, '')];
  if (!rate) return undefined;
  if (rate.intro && at.getTime() <= Date.parse(rate.intro.until)) {
    return { input: rate.intro.input, output: rate.intro.output };
  }
  return rate;
}

/** True when we hold a published rate for this model. */
export function isPriced(model: string | null | undefined, at: Date = new Date()): boolean {
  return Boolean(model && rateFor(model, at));
}

export function priceRun(
  sdkCostUsd: number | undefined,
  model: string | null | undefined,
  tokens: Tokens,
  at: Date = new Date(),
): PricedCost {
  if (typeof sdkCostUsd === 'number' && Number.isFinite(sdkCostUsd) && sdkCostUsd >= 0) {
    return { costUsd: round6(sdkCostUsd), costSource: 'sdk' };
  }

  const rate = model ? rateFor(model, at) : undefined;
  if (!rate) return { costUsd: null, costSource: 'unpriced' };

  const perToken = (millions: number) => millions / 1_000_000;
  const cost =
    tokens.inputTokens * perToken(rate.input) +
    tokens.outputTokens * perToken(rate.output) +
    tokens.cacheReadTokens * perToken(rate.input) * CACHE_READ_MULTIPLIER +
    tokens.cacheWriteTokens * perToken(rate.input) * CACHE_WRITE_MULTIPLIER;

  return { costUsd: round6(cost), costSource: 'derived' };
}

function round6(n: number): number {
  return Math.round(n * 1e6) / 1e6;
}
