/**
 * The save guard — `Plan §14`'s rule, on the client half.
 *
 * **What this instrument cannot see:** whether the server agrees. It compares a receipt against
 * the fields in a form; the server compares one against the ten instants it would actually fire.
 * Both are needed and neither substitutes: a client-only check is one any caller can skip, and a
 * server-only check is one nobody sees until after they press save.
 * `apps/runner/src/routes/__tests__/schedule-routes.test.ts` is the other half.
 */
import { describe, expect, it } from 'vitest';
import { scheduleFiresAreExact, TRIGGER_KINDS } from '@agnetos/contracts';
import {
  applyEdit,
  isPreviewable,
  saveVerdict,
  staleFields,
  type PreviewReceipt,
  type ScheduleDraft,
} from './saveGuard';

const draft = (over: Partial<ScheduleDraft> = {}): ScheduleDraft => ({
  line: '@sales/digest morning brief',
  triggerKind: 'cron',
  expression: '0 6 * * 1',
  tz: 'Asia/Riyadh',
  followMe: false,
  missedRunPolicy: 'catch_up_once',
  overlapPolicy: 'skip',
  jitterSeconds: 30,
  autoDisableAfter: 3,
  reviewAt: '2026-11-19T00:00:00.000Z',
  enabled: true,
  disabledReason: null,
  ...over,
});

const receipt = (over: Partial<PreviewReceipt> = {}): PreviewReceipt => ({
  triggerKind: 'cron',
  expression: '0 6 * * 1',
  tz: 'Asia/Riyadh',
  followMe: false,
  token: 'pv1_deadbeef',
  fireTimeCount: 10,
  ...over,
});

describe('the receipt is bound to what it was computed from', () => {
  it('lets a matching receipt through, carrying the token the save body needs', () => {
    expect(saveVerdict(draft(), receipt())).toEqual({ canSave: true, previewToken: 'pv1_deadbeef' });
  });

  it('refuses a save with no preview at all', () => {
    expect(saveVerdict(draft(), null)).toEqual({ canSave: false, block: { reason: 'no-preview' } });
  });

  /**
   * The bug this whole module exists for, written as the sequence that produces it: the dialog
   * previewed Mondays, the field was edited to the 1st of the month, and the receipt still says
   * Mondays. A guard that only checked *is there a token* would let this save.
   */
  it('refuses an edited expression carrying the receipt from the old one, and names the field', () => {
    const verdict = saveVerdict(draft({ expression: '0 6 1 * *' }), receipt());
    expect(verdict).toEqual({
      canSave: false,
      block: { reason: 'preview-stale', changed: ['expression'] },
    });
  });

  it.each([
    ['tz', { tz: 'Europe/London' }, ['tz']],
    ['followMe', { followMe: true }, ['followMe']],
    ['triggerKind', { triggerKind: 'interval' as const, expression: 'every 1800s from x' }, ['triggerKind', 'expression']],
  ])('a changed %s invalidates the receipt', (_label, patch, changed) => {
    const verdict = saveVerdict(draft(patch as Partial<ScheduleDraft>), receipt());
    expect(verdict.canSave).toBe(false);
    expect(verdict.canSave === false && verdict.block).toEqual({ reason: 'preview-stale', changed });
  });

  /**
   * `0 0 30 2 *` is a legal expression that fires on the 30th of February. It parses, it
   * previews, and it returns nothing — and saved, it is a row that is enabled, carries a clock
   * badge and never fires. *Never fired* is the failure detail 1 spends a whole table making
   * visible; refusing it at the dialog is cheaper than finding it in the ledger.
   */
  it('refuses an expression whose preview found no fire times at all', () => {
    expect(saveVerdict(draft({ expression: '0 0 30 2 *' }), receipt({ expression: '0 0 30 2 *', fireTimeCount: 0 })))
      .toEqual({ canSave: false, block: { reason: 'preview-empty' } });
  });
});

describe('the four kinds with no clockable occurrence', () => {
  it('save with previewToken null, because there is nothing to be quietly wrong about', () => {
    for (const kind of ['event', 'condition', 'chain', 'manual'] as const) {
      expect(saveVerdict(draft({ triggerKind: kind }), null)).toEqual({ canSave: true, previewToken: null });
    }
  });

  /**
   * The denominator is defined once on the server (`scheduleFiresAreExact`) and once here, and
   * two copies of "which triggers have a clock" would agree until somebody added a seventh kind.
   * Pinned against **every** member of the vocabulary rather than against a list written here,
   * so a new trigger kind cannot arrive unnoticed on one side.
   */
  it('agree with the contract about which two kinds have a clock', () => {
    for (const kind of TRIGGER_KINDS) {
      expect(isPreviewable(kind)).toBe(scheduleFiresAreExact(kind));
    }
    expect(TRIGGER_KINDS.filter(isPreviewable)).toEqual(['cron', 'interval']);
  });
});

describe('the mandatory answers come before the preview', () => {
  it.each(['missedRunPolicy', 'overlapPolicy', 'jitterSeconds', 'autoDisableAfter', 'reviewAt'] as const)(
    'refuses a draft missing %s, naming it',
    (field) => {
      const verdict = saveVerdict(draft({ [field]: null } as Partial<ScheduleDraft>), receipt());
      expect(verdict.canSave).toBe(false);
      expect(verdict.canSave === false && verdict.block.reason).toBe('policy-missing');
      expect(verdict.canSave === false && verdict.block.reason === 'policy-missing' && verdict.block.fields)
        .toContain(field);
    },
  );

  /**
   * Ordering, asserted rather than assumed: a form that says *"your preview is stale"* while
   * `overlapPolicy` is still empty has sent the person to re-preview something they will have to
   * re-preview again once they answer the question nobody asked them yet.
   */
  it('reports the missing policy, not the stale preview, when both are true', () => {
    const verdict = saveVerdict(draft({ overlapPolicy: null, expression: '0 9 * * *' }), receipt());
    expect(verdict.canSave === false && verdict.block.reason).toBe('policy-missing');
  });

  it('refuses a disabled schedule with no reason', () => {
    expect(saveVerdict(draft({ enabled: false, disabledReason: null }), receipt())).toEqual({
      canSave: false,
      block: { reason: 'disabled-without-reason' },
    });
    expect(saveVerdict(draft({ enabled: false, disabledReason: 'too noisy' }), receipt()).canSave).toBe(true);
  });
});

describe('applyEdit is the mechanism, not the rule', () => {
  /**
   * A dialog that kept the receipt and merely recomputed the verdict would be correct too — and
   * every future caller would have to remember to. Dropping it inside the one function that
   * applies edits means a stale receipt cannot survive the keystroke that invalidated it.
   */
  it('drops the receipt on an edit that moves the fire times', () => {
    const after = applyEdit({ draft: draft(), receipt: receipt() }, { expression: '0 9 * * *' });
    expect(after.receipt).toBeNull();
  });

  it('keeps it on an edit that cannot move them', () => {
    const after = applyEdit({ draft: draft(), receipt: receipt() }, { jitterSeconds: 120, line: '#sales' });
    expect(after.receipt).not.toBeNull();
    expect(saveVerdict(after.draft, after.receipt).canSave).toBe(true);
  });

  it('is a no-op on a state that never had one', () => {
    expect(applyEdit({ draft: draft(), receipt: null }, { tz: 'UTC' }).receipt).toBeNull();
  });

  /**
   * Jitter genuinely does not move `occurrence_time` — it moves when a run *starts*. Asserting
   * that here rather than trusting `staleFields`'s key list is what keeps the two facts tied: if
   * jitter ever became part of the previewed input, this test and the server's token would
   * disagree loudly instead of the strip drifting quietly.
   */
  it('treats exactly the four previewed fields as invalidating, and nothing else', () => {
    expect(staleFields(draft({ jitterSeconds: 999, line: 'x', enabled: false }), receipt())).toEqual([]);
    expect(staleFields(draft({ tz: 'UTC', followMe: true }), receipt()).sort()).toEqual(['followMe', 'tz']);
  });
});
