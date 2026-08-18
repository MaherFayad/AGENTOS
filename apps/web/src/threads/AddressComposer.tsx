'use client';

/* =============================================================================
 * AddressComposer.tsx — compose a new thread (`Plan §12`, `Plan §23.8`)
 *
 * `@agent` · `#department` · `@@fan-out` · bare. One text field, because the line
 * *is* the address: `CreateThreadRequest` takes `line` and nothing else, and
 * `api-contracts.md` says why splitting the address into its own field was
 * rejected — "the composer would then have to parse the line to fill the field,
 * which is the parser living in two places, and the second copy is the one that
 * guesses."
 *
 * All judgement lives in `lib/preview.ts`, which is pure and node-loadable. This
 * file draws it and decides nothing.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * THE THREE THINGS THIS SURFACE MUST NOT GET WRONG
 *
 * 1. NO MONEY FIGURE, ANYWHERE. `Plan §23.8` asks for `@@sales · 4 runs · ~$0.40`.
 *    The `4` is the resolved member count and it is real. **The `$0.40` has no
 *    source** — zero runs have ever completed, so there is nothing to average, and
 *    a cost preview is exactly the surface where a plausible number gets believed
 *    (BOARD rule 9). `TurnCost.estimatedUsd` is typed `null` so a figure stops the
 *    file compiling; this component adds no prop, no key and no slot that could
 *    carry one, and `AddressBadge` is the only thing that draws the count.
 *    `#sales` prints "at least 1 run", never "1 run": the lead answers **or
 *    delegates**, and a delegation is a second run.
 *
 * 2. `@@` REQUIRES AN EXPLICIT CONFIRM THAT NAMES THE COUNT — BOARD, `Plan §23.11`
 *    rule 7. Not a tooltip and not a hover: a thumb has no hover and a tooltip is
 *    not a decision. The confirm is a panel with two buttons, it is **reachable
 *    and dismissable from the keyboard without the fan-out firing** (Escape and
 *    the Cancel button, which takes focus on open so a stray Enter cancels), and
 *    Tab is held between the two controls so the dismiss is never off-screen.
 *
 * 3. `steer` IS REFUSED, ALWAYS, AND IS PRESENTED AS REFUSED WITH A STATED REASON.
 *    Three equally-available levels would be a lie: the runner answers every steer
 *    with 409 `interrupt_not_deliverable`, in flight or not
 *    (`MID_RUN_STEER.supported === false` on the runner, mirrored into the web
 *    bundle as `STEER_DELIVERY.supported`, which is the constant this file reads
 *    and the only one it can). So the third control is `aria-disabled`
 *    and **still focusable** — a `disabled` radio is skipped by arrow keys and the
 *    reason would then be announced to nobody — and the reason is visible text,
 *    not a tooltip, tied to the control by `aria-describedby`.
 *
 * WHY THE `steer` CONTROL IS RENDERED AT ALL. Deleting it would be the friendlier
 * screen and the worse one: `Plan §12` has three levels, a person who has read the
 * plan will look for the third, and "it is not here" is indistinguishable from "I
 * cannot find it". Drawn-and-refused says which.
 * ========================================================================== */

import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  FAN_OUT_DISPATCH,
  INTERRUPT_LEVELS,
  RUNNER_ROUTES,
  type InterruptLevel,
} from '@agnetos/contracts';
import { projectPath } from '@agnetos/contracts';
import { AddressBadge, InterruptBadge, STEER_DELIVERY } from '@/components/primitives';
import { useProjectHref, useProjectSegment } from '@/components/shell';
import { elementDirection, inlineStep, useT } from '@/i18n';
import { previewLine } from './lib/preview';
import type { DepartmentRoster } from './lib/roster';
import s from './threads.module.css';

/**
 * The project-scoped URL, or `null` for *"there is nothing to ask for"*.
 *
 * `projectPath` is `packages/contracts`' own helper and it **throws** on a segment
 * that is not a project slug, so a malformed address bar cannot become a POST.
 * Catching it here rather than letting it escape keeps the composer rendering: a
 * bad URL is a reason to refuse to send, not a reason to white-screen the view.
 * Same rule, same helper, as the shell's own `projectApiUrl`.
 */
function threadCreateUrl(project: string | null): string | null {
  if (project === null) return null;
  try {
    return projectPath(RUNNER_ROUTES.threadCreate.path, project);
  } catch {
    return null;
  }
}

type SendState =
  | { state: 'idle' }
  | { state: 'sending' }
  /** Verbatim from the API's uniform error body. Written for a person, not a log. */
  | { state: 'refused'; message: string; hint: string | null };

export interface AddressComposerProps {
  /**
   * Department member counts, from `rosterFrom()`. **An empty roster means nobody
   * counted**, and every `@@` then previews as `unresolved` with no numeral —
   * which is the honest answer and is visibly different from a measured zero.
   *
   * Passed in rather than read from `useShell()` here on purpose: this component's
   * own tests render it without the shell around it, and dragging a context
   * requirement into it would make every one of them a shell test. Same argument
   * `useProjectHref` records for the same reason.
   */
  roster: DepartmentRoster;
  autoFocus?: boolean;
}

export function AddressComposer({
  roster,
  autoFocus = false,
}: AddressComposerProps): React.JSX.Element {
  const t = useT();
  const router = useRouter();
  const href = useProjectHref();
  const project = useProjectSegment();

  const [line, setLine] = useState('');
  const [level, setLevel] = useState<InterruptLevel>('note');
  const [confirming, setConfirming] = useState(false);
  const [send, setSend] = useState<SendState>({ state: 'idle' });

  const inputId = useId();
  const steerReasonId = useId();
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus();
  }, [autoFocus]);

  const preview = useMemo(() => previewLine(line, roster), [line, roster]);

  const canSend = preview.address !== null && send.state !== 'sending';

  const create = useCallback(
    async (interrupt: InterruptLevel) => {
      const url = threadCreateUrl(project);
      if (url === null) {
        setSend({ state: 'refused', message: t('threads.compose.noProject'), hint: null });
        return;
      }
      setSend({ state: 'sending' });
      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'content-type': 'application/json', accept: 'application/json' },
          body: JSON.stringify({ line, interrupt }),
        });
        const json: unknown = await response.json().catch(() => null);
        if (!response.ok) {
          setSend(refusalFrom(json, t('threads.compose.refusedFallback')));
          return;
        }
        const id = threadIdOf(json);
        if (id === null) {
          setSend({ state: 'refused', message: t('threads.compose.malformed'), hint: null });
          return;
        }
        setLine('');
        setConfirming(false);
        setSend({ state: 'idle' });
        router.push(href(`/threads/${encodeURIComponent(id)}`));
      } catch {
        setSend({ state: 'refused', message: t('threads.compose.offline'), hint: null });
      }
    },
    [href, line, project, router, t],
  );

  const submit = (event: React.FormEvent): void => {
    event.preventDefault();
    if (!canSend) return;
    // `@@` never sends on submit. It opens the confirm, and the confirm names the
    // count — BOARD, `Plan §23.11` rule 7.
    if (preview.needsFanOutConfirm) {
      setConfirming(true);
      return;
    }
    void create(level);
  };

  return (
    <form className={s.composer} onSubmit={submit} aria-labelledby={`${inputId}-label`}>
      <label id={`${inputId}-label`} htmlFor={inputId} className={`u-label ${s.composerLabel}`}>
        {t('threads.compose.label')}
      </label>

      <textarea
        id={inputId}
        ref={inputRef}
        className={s.input}
        rows={2}
        value={line}
        placeholder={t('threads.compose.placeholder')}
        onChange={(event) => {
          setLine(event.target.value);
          // The typed line changed, so a confirm raised for the old line is about
          // a count that is no longer on screen. Dropping it is the safe
          // direction: the person re-submits and re-reads the number.
          setConfirming(false);
          setSend({ state: 'idle' });
        }}
      />

      <div className={s.previewRow}>
        {preview.address !== null && (
          <AddressBadge address={preview.address} cost={preview.cost ?? undefined} />
        )}
        {preview.refusal !== null && (
          // The parser's own sentence, verbatim. It names the token and offers the
          // two spellings that would have worked; rewriting it here would be a
          // second copy of a refusal whose wording is the contract's.
          <p className={s.refusal}>
            {/* `<bdi>` for the same reason `AddressBadge` uses one, and it is the
                stronger case: this is the token the parser REFUSED, so it is
                whatever the person typed. `&sales` and `@@` lead with bidi-neutral
                characters, and a neutral at the start of a run inside an RTL
                paragraph takes the paragraph's direction — it detaches and renders
                at the far end of the Latin run. Measured, not assumed; the same
                reordering is what moved the `@` off `@sales` in the placeholder. */}
            <bdi className={s.token}>{preview.refusal.token}</bdi> {preview.refusal.hint}
          </p>
        )}
        {preview.unknownDepartment !== null && (
          <p className={s.hint}>
            {t('threads.compose.unknownDepartment', { name: preview.unknownDepartment })}
          </p>
        )}
      </div>

      <InterruptLevels
        level={level}
        onPick={setLevel}
        reasonId={steerReasonId}
        disabled={confirming}
      />
      <p id={steerReasonId} className={s.hint}>
        {t('a11y.threads.interrupt.undeliverable')}
      </p>

      {confirming ? (
        <FanOutConfirm
          preview={preview}
          onCancel={() => {
            setConfirming(false);
            inputRef.current?.focus();
          }}
          onConfirm={() => void create(level)}
          busy={send.state === 'sending'}
        />
      ) : (
        <div className={s.actions}>
          <button type="submit" className={s.send} disabled={!canSend}>
            {t(preview.needsFanOutConfirm ? 'threads.compose.review' : 'threads.compose.send')}
          </button>
        </div>
      )}

      {send.state === 'refused' && (
        <p className={s.refusal} role="status">
          {send.message}
          {send.hint === null ? null : ` ${send.hint}`}
        </p>
      )}
    </form>
  );
}

/* -------------------------------------------------------------------------- *
 * The three levels — two offered, one refused
 * -------------------------------------------------------------------------- */

/**
 * **Which levels this build can actually deliver — derived, not typed out.**
 *
 * What stood here was `const refused = candidate === 'steer'` under a comment
 * claiming *"the register reads the runner's own constant and its test fails if the
 * two disagree"*. The claim was true of the sibling composer
 * (`drawer/threads/mailbox.ts:65-70`, `isComposable`) and false of this file, which
 * imported neither constant — so the day a steer becomes deliverable, one composer
 * would follow and the other would keep drawing a refusal forever with nothing red.
 * BOARD's *"a comment is not a mechanism"*, in its quietest form: the mechanism
 * existed, one file away. (fidelity-qa-reviewer, M16 acceptance, follow-up 1.)
 *
 * `STEER_DELIVERY.supported` is the one fact, and it is not a free-floating
 * pessimism: `InterruptBadge.test.tsx` reads `apps/runner/src/lib/mailbox.ts` and
 * fails if `MID_RUN_STEER.supported` and this constant disagree.
 *
 * **Lifting the refusal is a compile error in this file**, which is the property the
 * literal did not have. With `supported: true`, `DeliverableLevel` widens to
 * `InterruptLevel`, `isDeliverable` stops narrowing `steer` out of the offered
 * branch, and `<InterruptBadge level={candidate} />` there no longer compiles —
 * because `InterruptBadge`'s props make a caller offering `steer` answer *"is a run
 * in flight?"*. A new-thread composer has to answer that explicitly rather than
 * inherit it, and now it must.
 */
type DeliverableLevel = typeof STEER_DELIVERY.supported extends true
  ? InterruptLevel
  : Exclude<InterruptLevel, 'steer'>;

const isDeliverable = (level: InterruptLevel): level is DeliverableLevel =>
  level !== 'steer' || STEER_DELIVERY.supported;

/**
 * **Arrow keys, and the reason they are here rather than assumed.**
 *
 * This is a `role="radiogroup"` of buttons, which is the one shape that owes its
 * own key handling — the platform gives it nothing. It shipped with none, while
 * the comment on `aria-disabled` below argued from what arrow keys do to a
 * `disabled` radio. That is BOARD's *"a comment is not a mechanism"*: the reason
 * the refusal is `aria-disabled` was sound, and the mechanism it was protecting
 * did not exist, so `steer`'s stated reason was reachable by Tab only and by luck
 * — every button was in the tab order because none had a roving `tabIndex`.
 *
 * The step comes from `inlineStep`, never from `+1` on ArrowRight.
 * `MIRRORS['shell.segmentedControl']` — *"tab order is reading order"* — governs
 * this row too: it is an `inline-flex` row, so `dir="rtl"` reverses it on its own
 * and a fixed `+1` would walk toward the control on the reader's other side. That
 * exact bug shipped twice in M15, in `DepartmentTabs` and in `SegmentedControl`,
 * and this is the fourth site of the same class. `elementDirection` reads the
 * direction off the rendered tree rather than off the locale, so a composer inside
 * one of §2.5's or §3.1's LTR islands still keys LTR on an RTL page.
 *
 * **Arrows land on the refused rung and do not select it.** That is the whole
 * point of `aria-disabled`: focus reaches it, `aria-describedby` announces why it
 * is refused, and nothing is chosen. Skipping it would put the reason back out of
 * reach, which is the state this comment used to describe as if it were fixed.
 */
function InterruptLevels({
  level,
  onPick,
  reasonId,
  disabled,
}: {
  level: InterruptLevel;
  onPick: (level: InterruptLevel) => void;
  reasonId: string;
  disabled: boolean;
}): React.JSX.Element {
  const t = useT();
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  const onKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, index: number): void => {
    // The step is along the LIST and the wrap with it — never along the screen.
    const delta = inlineStep(event.key, elementDirection(event.currentTarget));
    if (delta === 0) return;
    event.preventDefault();
    const next = (index + delta + INTERRUPT_LEVELS.length) % INTERRUPT_LEVELS.length;
    refs.current[next]?.focus();
    const candidate = INTERRUPT_LEVELS[next];
    // Focus moves onto a refused rung; selection does not follow it there. Same
    // derivation as the row below — a second `=== 'steer'` here would be the same
    // defect in the keyboard path, where it is harder to see.
    if (!isDeliverable(candidate) || disabled) return;
    onPick(candidate);
  };

  return (
    <div className={s.levels} role="radiogroup" aria-label={t('threads.compose.levelLabel')}>
      {INTERRUPT_LEVELS.map((candidate, index) => {
        // Derived from `STEER_DELIVERY`, never from the level's name — see
        // `isDeliverable` above for why that distinction is the finding.
        const refused = !isDeliverable(candidate);
        return (
          <button
            key={candidate}
            ref={(element) => {
              refs.current[index] = element;
            }}
            type="button"
            role="radio"
            className={s.level}
            aria-checked={level === candidate}
            // `aria-disabled`, not `disabled`: a disabled control is skipped by
            // arrow keys and its reason is then announced to nobody. This one is
            // reachable, says why it is refused, and does nothing when pressed.
            aria-disabled={refused || disabled}
            aria-describedby={refused ? reasonId : undefined}
            // Roving: Tab enters the group once, arrows move within it. The
            // refused rung is never the selected one, so it is never the tab
            // stop — arrows are what reach it, which is why they had to exist.
            tabIndex={level === candidate ? 0 : -1}
            onKeyDown={(event) => onKeyDown(event, index)}
            onClick={() => {
              if (refused || disabled) return;
              onPick(candidate);
            }}
          >
            {/* The predicate is called here rather than reading `refused`, because
                the narrowing is the gate: this is the line that stops compiling on
                the day `STEER_DELIVERY.supported` flips. */}
            {isDeliverable(candidate) ? (
              <InterruptBadge level={candidate} size="sm" />
            ) : (
              <InterruptBadge level="steer" deliverable={false} size="sm" />
            )}
            <span>{t(LEVEL_LABEL[candidate])}</span>
          </button>
        );
      })}
    </div>
  );
}

const LEVEL_LABEL = {
  note: 'threads.interrupt.note',
  steer: 'threads.interrupt.steer',
  halt: 'threads.interrupt.halt',
} as const;

/* -------------------------------------------------------------------------- *
 * The fan-out confirm
 * -------------------------------------------------------------------------- */

/**
 * Names the count, states that no run will start, and cannot be committed by
 * accident.
 *
 * **Why the positive button is not "Start N runs".** It cannot start them:
 * `FAN_OUT_DISPATCH.allowed` is typed `false` and `assertFanOutDispatchable`
 * throws `fanout_dispatch_refused` (503) until the workspace cap has proven it can
 * refuse something — and it has never once fired, because zero runs have executed.
 * The thread is still created; `CreateThreadResponse.dispatchable` carries the
 * refusal with the row. So the button says what actually happens — the thread
 * opens — and the panel states the count that *would* be spent and the fact that
 * nothing is spent today. Both facts, because either one alone is misleading in a
 * different direction.
 *
 * **Keyboard.** Cancel takes focus on open, so Enter and Space cancel. Escape
 * cancels. Tab cycles between the two buttons and does not leave the panel, so the
 * dismiss is never scrolled away from a thumb or a screen reader. None of those
 * paths can fire the fan-out — `Plan §23.11` rule 7 asks for exactly that.
 */
function FanOutConfirm({
  preview,
  onCancel,
  onConfirm,
  busy,
}: {
  preview: ReturnType<typeof previewLine>;
  onCancel: () => void;
  onConfirm: () => void;
  busy: boolean;
}): React.JSX.Element {
  const t = useT();
  const cancelRef = useRef<HTMLButtonElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const headingId = useId();

  useEffect(() => {
    cancelRef.current?.focus();
  }, []);

  const department =
    preview.address !== null && preview.address.form === 'fan-out' ? preview.address.department : '';

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>): void => {
    if (event.key === 'Escape') {
      event.stopPropagation();
      onCancel();
      return;
    }
    if (event.key !== 'Tab') return;
    const active = document.activeElement;
    if (!event.shiftKey && active === confirmRef.current) {
      event.preventDefault();
      cancelRef.current?.focus();
    } else if (event.shiftKey && active === cancelRef.current) {
      event.preventDefault();
      confirmRef.current?.focus();
    }
  };

  return (
    <div
      className={s.confirm}
      role="alertdialog"
      aria-labelledby={headingId}
      onKeyDown={onKeyDown}
    >
      <span id={headingId} className={`u-label ${s.confirmEyebrow}`}>
        {t('threads.fanout.eyebrow')}
      </span>

      {/* The count, named. `cost` is the same `TurnCost` the badge draws, so the
          panel and the badge cannot disagree — and when the roster was never
          counted the panel says so instead of showing a number it does not have. */}
      <p className={s.confirmBody}>
        {preview.cost === 'unresolved' || preview.cost === null
          ? t('threads.fanout.countUnknown', { name: department })
          : t('threads.fanout.count', { name: department, count: preview.cost.runs })}
      </p>

      {/* And the second fact: nothing is spent today, and what would change that. */}
      <p className={s.confirmRefusal}>
        {t('threads.fanout.refused', { unblockedBy: FAN_OUT_DISPATCH.unblockedBy })}
      </p>

      <div className={s.confirmActions}>
        <button type="button" ref={cancelRef} onClick={onCancel}>
          {t('threads.fanout.cancel')}
        </button>
        <button type="button" ref={confirmRef} onClick={onConfirm} disabled={busy}>
          {t('threads.fanout.open')}
        </button>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- *
 * Reading the API's answers defensively
 * -------------------------------------------------------------------------- */

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

/** `CreateThreadResponse.thread.id`, or `null` if the body is not what we agreed. */
function threadIdOf(json: unknown): string | null {
  if (!isRecord(json) || !isRecord(json.thread)) return null;
  const id = json.thread.id;
  return typeof id === 'string' && id.length > 0 ? id : null;
}

/**
 * The uniform `{error:{code,message,hint?}}` body, shown verbatim.
 *
 * Verbatim on purpose: `address_unresolved` lists nothing useful in a code, and
 * `address_ambiguous`'s hint **lists the matches** (thread-model §3.3). Rewriting
 * either here would be a second copy of a refusal whose wording is the contract's
 * — and the copy is the one that goes stale.
 */
function refusalFrom(json: unknown, fallback: string): SendState {
  if (!isRecord(json) || !isRecord(json.error)) {
    return { state: 'refused', message: fallback, hint: null };
  }
  const message = typeof json.error.message === 'string' ? json.error.message : fallback;
  const hint = typeof json.error.hint === 'string' ? json.error.hint : null;
  return { state: 'refused', message, hint };
}
