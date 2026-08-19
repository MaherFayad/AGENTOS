/**
 * The save dialog's half of *"never save an unpreviewed cron expression"* (`Plan §14`,
 * `comms/contracts/scheduling.md` §6.1).
 *
 * Owner: `scheduler-engineer`. Pure — no React, no fetch, no clock — so the rule is checkable
 * without a browser, which is the same argument `planTick` makes on the server.
 *
 * ## Why this exists when the server already refuses
 *
 * `POST /api/p/:project/schedules` recomputes the receipt and answers `schedule_preview_stale`
 * (409). That refusal is correct and it is the one that actually protects the database. It is
 * also **the wrong place for a person to meet it**: by then the dialog has been submitted, and
 * the user's model of what they confirmed is a round trip old. The failure this catches is
 * ordinary and quiet — a preview of `0 6 * * 1`, a field edited to `0 6 1 * *` before the
 * button, and a schedule that fires monthly under a screen that said Mondays.
 *
 * So the same rule is enforced twice, deliberately, and the two halves are **not** the same
 * check: the client compares the receipt against the fields *currently in the form*, and the
 * server compares it against the ten instants it would actually fire. A client-only check is a
 * check any caller can skip; a server-only check is a check nobody sees until after they press
 * save.
 *
 * ## The decision this module encodes
 *
 * **A receipt is bound to the three fields it was computed from**, not merely present. `token`
 * alone would let a stale receipt travel with an edited expression, which is exactly the bug —
 * the dialog would look confirmed and be wrong. Every field that changes the ten instants
 * invalidates it, and the guard names which one, so the button can say why it is disabled
 * rather than being mysteriously grey.
 */

import type { MissedRunPolicy, OverlapPolicy, TriggerKind } from '@agnetos/contracts';

/** The fields a preview is computed from. Change any one and the ten instants can move. */
export interface PreviewedInput {
  triggerKind: TriggerKind;
  /** `cron` → the expression; `interval` → `every {n}s from {anchor}`; the server's spelling. */
  expression: string;
  tz: string;
  followMe: boolean;
}

/** What came back from `POST …/schedules/preview`, kept with what it was computed from. */
export interface PreviewReceipt extends PreviewedInput {
  token: string;
  /** Ten, unless the expression genuinely has fewer — `0 0 30 2 *` has none. */
  fireTimeCount: number;
}

/** The form, as far as this rule is concerned. */
export interface ScheduleDraft extends PreviewedInput {
  /** The address line — `@sales/digest`, `#sales`, or empty for the Chief of Staff. */
  line: string;
  missedRunPolicy: MissedRunPolicy | null;
  overlapPolicy: OverlapPolicy | null;
  jitterSeconds: number | null;
  autoDisableAfter: number | null;
  reviewAt: string | null;
  enabled: boolean;
  disabledReason: string | null;
}

/**
 * Why the save button is not available. Each is a different sentence to a person, which is the
 * reason this is a union and not a boolean — a disabled control with no stated cause is the
 * commonest way a form becomes unusable without anybody being able to say what is wrong.
 */
export type SaveBlock =
  | { reason: 'no-preview' }
  | { reason: 'preview-stale'; changed: readonly (keyof PreviewedInput)[] }
  | { reason: 'preview-empty' }
  | { reason: 'policy-missing'; fields: readonly string[] }
  | { reason: 'disabled-without-reason' };

export type SaveVerdict =
  | { canSave: true; previewToken: string | null }
  | { canSave: false; block: SaveBlock };

/**
 * `cron` and `interval` are the only kinds with occurrences a clock can compute, so they are the
 * only ones a preview means anything for. `scheduleFiresAreExact` is the same denominator on the
 * server; it is not imported here because this module is deliberately dependency-light for the
 * `node --test` half of the web suite, and the two are pinned to each other by a test.
 */
export const isPreviewable = (kind: TriggerKind): boolean => kind === 'cron' || kind === 'interval';

/** Which previewed fields differ between the receipt and the form. Empty ⇒ the receipt holds. */
export function staleFields(draft: PreviewedInput, receipt: PreviewedInput): (keyof PreviewedInput)[] {
  const keys: (keyof PreviewedInput)[] = ['triggerKind', 'expression', 'tz', 'followMe'];
  return keys.filter((key) => draft[key] !== receipt[key]);
}

/**
 * Can this draft be saved, and if not, what does the button say?
 *
 * The order is the order a person would want to hear it: the mandatory answers first, then the
 * preview. A form that says *"your preview is stale"* while `overlap_policy` is still empty has
 * sent the user to re-preview something they will have to re-preview again.
 */
export function saveVerdict(draft: ScheduleDraft, receipt: PreviewReceipt | null): SaveVerdict {
  const missing: string[] = [];
  if (draft.missedRunPolicy === null) missing.push('missedRunPolicy');
  if (draft.overlapPolicy === null) missing.push('overlapPolicy');
  if (draft.jitterSeconds === null) missing.push('jitterSeconds');
  if (draft.autoDisableAfter === null) missing.push('autoDisableAfter');
  if (draft.reviewAt === null) missing.push('reviewAt');
  if (draft.tz.trim() === '') missing.push('tz');
  if (missing.length > 0) return { canSave: false, block: { reason: 'policy-missing', fields: missing } };

  // `schedule_disabled_names_a_reason`, at the edge where a person can still answer it. A
  // disabled schedule with no reason is indistinguishable from one somebody turned off on
  // purpose, which is how thirty failed nights stay invisible.
  if (!draft.enabled && (draft.disabledReason === null || draft.disabledReason.trim() === '')) {
    return { canSave: false, block: { reason: 'disabled-without-reason' } };
  }

  // The four kinds with no clockable occurrence have nothing to preview and nothing to be
  // quietly wrong about. `previewToken: null` is legal for exactly these.
  if (!isPreviewable(draft.triggerKind)) return { canSave: true, previewToken: null };

  if (receipt === null) return { canSave: false, block: { reason: 'no-preview' } };

  const changed = staleFields(draft, receipt);
  if (changed.length > 0) return { canSave: false, block: { reason: 'preview-stale', changed } };

  /**
   * A previewed expression that fires **nothing** is not a confirmed schedule.
   *
   * `0 0 30 2 *` parses, previews, and returns zero fire times — the 30th of February. Saving it
   * produces a row that is enabled, looks scheduled, carries a clock badge and never fires, and
   * *"never fired"* is the failure detail 1 spends a whole table making visible. Refusing it at
   * the dialog is cheaper than discovering it in the ledger.
   */
  if (receipt.fireTimeCount === 0) return { canSave: false, block: { reason: 'preview-empty' } };

  return { canSave: true, previewToken: receipt.token };
}

/**
 * Fold an edit into the draft **and drop the receipt when the edit moves the fire times.**
 *
 * This is the mechanism rather than the rule: a dialog that kept the receipt and merely recomputed
 * `saveVerdict` would be correct too, but every future caller would have to remember to. Returning
 * `receipt: null` from the one function that applies edits means the stale receipt cannot survive
 * the keystroke that invalidated it.
 */
export function applyEdit(
  state: { draft: ScheduleDraft; receipt: PreviewReceipt | null },
  patch: Partial<ScheduleDraft>,
): { draft: ScheduleDraft; receipt: PreviewReceipt | null } {
  const draft = { ...state.draft, ...patch };
  if (state.receipt === null) return { draft, receipt: null };
  return { draft, receipt: staleFields(draft, state.receipt).length === 0 ? state.receipt : null };
}
