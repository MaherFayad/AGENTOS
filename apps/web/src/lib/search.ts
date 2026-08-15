/**
 * Fuzzy search over the agent library — spec §2.0 ("Search = fuzzy over agent
 * names/descriptions; result click = fly-to-node").
 *
 * Pure and framework-free on purpose: the shell's search pill is the keyboard route to
 * every node on a canvas map, so the ranking it depends on has to be unit-testable
 * without a DOM.
 *
 * Owner: shell-navigation-engineer.
 */

/** What a result points at. Drives both the icon and what happens on Enter. */
export type SearchKind = 'agent' | 'department' | 'panel' | 'session';

export interface SearchItem {
  /** Stable id. For agents this is the graph node id, e.g. `sales/account-enrichment`. */
  id: string;
  kind: SearchKind;
  /** What the user reads, e.g. `Account Enrichment`. */
  label: string;
  /** Secondary line; also searched, at a lower weight. */
  description?: string;
  /** Department slug (ADR-001), when the item has one. */
  department?: string;
  /** Route this result navigates to. */
  href: string;
  /** `live` agents sort ahead of drafts at equal score — real runs first (rule 9). */
  live?: boolean;
}

/** Character ranges in `label` that matched, for highlighting. `[start, endExclusive)`. */
export type MatchRange = readonly [number, number];

export interface FuzzyMatch {
  score: number;
  ranges: MatchRange[];
}

export interface SearchResult {
  item: SearchItem;
  score: number;
  /** Ranges into `item.label`. Empty when only the description matched. */
  ranges: MatchRange[];
}

export interface SearchOptions {
  /** Hard cap on returned results. The listbox is keyboard-walked, so keep it small. */
  limit?: number;
}

const BONUS_FIRST_CHAR = 18;
const BONUS_WORD_START = 12;
const BONUS_CONSECUTIVE = 8;
const PENALTY_GAP = 1;
const PENALTY_MAX_GAP = 12;

const isBoundary = (text: string, index: number): boolean => {
  if (index === 0) return true;
  const prev = text[index - 1] ?? '';
  return /[\s\-_/.·]/.test(prev);
};

/**
 * Greedy left-to-right subsequence match with position bonuses.
 *
 * Greedy (rather than optimal-alignment) is deliberate: it is O(n), it is what every
 * editor's quick-open feels like, and the failure mode — a slightly lower score on a
 * pathological string — never changes whether an item appears, only its rank.
 *
 * Returns `null` when `query` is not a subsequence of `text`.
 */
export function fuzzyMatch(query: string, text: string): FuzzyMatch | null {
  const q = query.trim().toLowerCase();
  if (q.length === 0) return null;

  const haystack = text.toLowerCase();
  const ranges: MatchRange[] = [];
  let score = 0;
  let cursor = 0;
  let runStart = -1;
  let runEnd = -1;

  for (const char of q) {
    if (char === ' ') continue; // spaces in a query mean "then, later" — not a literal
    const found = haystack.indexOf(char, cursor);
    if (found === -1) return null;

    const gap = found - cursor;
    if (found === 0) score += BONUS_FIRST_CHAR;
    else if (isBoundary(haystack, found)) score += BONUS_WORD_START;
    if (found === runEnd) score += BONUS_CONSECUTIVE;
    score -= Math.min(gap, PENALTY_MAX_GAP) * PENALTY_GAP;

    if (found === runEnd) {
      runEnd = found + 1;
    } else {
      if (runStart !== -1) ranges.push([runStart, runEnd]);
      runStart = found;
      runEnd = found + 1;
    }
    cursor = found + 1;
  }
  if (runStart !== -1) ranges.push([runStart, runEnd]);

  // Shorter labels win ties: matching 2 of 8 chars beats matching 2 of 80.
  score += Math.max(0, 20 - Math.floor(haystack.length / 4));
  return { score, ranges };
}

const LABEL_WEIGHT = 2;
const LABEL_FLOOR = 40; // any label hit outranks any description-only hit
const DESCRIPTION_WEIGHT = 1;
const LIVE_BONUS = 3;

/**
 * Rank `items` against `query`. Empty/blank query returns `[]` — the shell shows no
 * dropdown until the user has typed, rather than guessing what they wanted.
 */
export function search(
  items: readonly SearchItem[],
  query: string,
  options: SearchOptions = {},
): SearchResult[] {
  const q = query.trim();
  if (q.length === 0) return [];
  const limit = options.limit ?? 8;

  const scored: SearchResult[] = [];
  for (const item of items) {
    const onLabel = fuzzyMatch(q, item.label);
    const onDescription = item.description ? fuzzyMatch(q, item.description) : null;
    if (!onLabel && !onDescription) continue;

    const score = onLabel
      ? LABEL_FLOOR + onLabel.score * LABEL_WEIGHT
      : (onDescription as FuzzyMatch).score * DESCRIPTION_WEIGHT;

    scored.push({
      item,
      score: score + (item.live ? LIVE_BONUS : 0),
      ranges: onLabel ? onLabel.ranges : [],
    });
  }

  scored.sort(
    (a, b) =>
      b.score - a.score ||
      a.item.label.length - b.item.label.length ||
      a.item.label.localeCompare(b.item.label),
  );
  return scored.slice(0, limit);
}

/** Split a label into matched/unmatched segments for rendering the highlight. */
export function highlightSegments(
  label: string,
  ranges: readonly MatchRange[],
): Array<{ text: string; matched: boolean }> {
  if (ranges.length === 0) return [{ text: label, matched: false }];
  const segments: Array<{ text: string; matched: boolean }> = [];
  let at = 0;
  for (const [start, end] of ranges) {
    if (start > at) segments.push({ text: label.slice(at, start), matched: false });
    segments.push({ text: label.slice(start, end), matched: true });
    at = end;
  }
  if (at < label.length) segments.push({ text: label.slice(at), matched: false });
  return segments;
}
