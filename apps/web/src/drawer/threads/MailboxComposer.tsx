'use client';

/**
 * The mailbox composer — `Plan §12` · `§23.12 P2`, and the return path the run console
 * never had.
 *
 * `RunConsole` was one-way: a person watched tokens arrive and could Stop, Allow or Deny.
 * This is the other direction — a turn appended to the thread the run is having, with the
 * sender declaring how disruptively it lands. Same visual grammar as the drawer's other
 * additions; monochrome throughout, because a choice a sender is about to make is not a
 * status and has no value to spend data ink on (§1.3).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * TWO LEVELS AND A REFUSAL — and the refusal is drawn, not thrown
 *
 * `note` and `halt` are radio options. `steer` is **not an option**: it is not a button,
 * not a disabled button, and not focusable as a choice. It is an `InterruptBadge` in its
 * refused state — dashed, `--ink-2` — beside the reason, because thread-model §4.2 lists
 * three levels and this build honours two, and a reader who sees only two concludes they
 * missed something.
 *
 * The reason is `a11y.threads.interrupt.undeliverable`, the same catalogue string the
 * badge announces, rendered `aria-hidden` here so it is not read twice. **Not a
 * composer-voice paraphrase**: that sentence has already been wrong once — it used to say
 * *"Nothing is running on this thread"*, which is §4.2's condition and not the runner's,
 * so it told a reader with a run in flight that the refusal did not apply to them. One
 * sentence with one owner cannot drift from itself.
 *
 * Nothing here catches a 409 and retries as a note. There is nothing to catch:
 * `ComposableLevel` excludes `steer`, so the request cannot be built. A silent downgrade
 * is the one behaviour `thread-model.md` invariant 7 forbids outright.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHAT IT SAYS AFTERWARDS, AND WHAT IT REFUSES TO SAY
 *
 * `disposition` — `queued` or `delivered-to-run` — is the runner's own account of where
 * the message went, and the two get different sentences. "Sent" would be the blur.
 *
 * `threadState` is the state **as at the append**, read before the message was written.
 * A halt does not move the thread here; the run's next drain reads it, aborts the session
 * and moves it then. So every state sentence is past tense and a halt gets a fourth line
 * saying the move has not happened yet. Rendering "now waiting" off this field would be a
 * state the runner has not reached — `api-contracts.md` said it did until tonight, and
 * this component is exactly the reader that would have believed it.
 *
 * No money figure anywhere: `TurnCost.estimatedUsd` is typed `null` and zero runs have
 * completed, so there is nothing to average (BOARD rule 9).
 *
 * Owner: drawer-engineer
 */

import { useId, useState } from 'react';
import { useT, type StringKey } from '@/i18n';
import { InterruptBadge, Pill, cx } from '../primitives';
import {
  canSend,
  composableLevels,
  DEFAULT_LEVEL,
  outcomeKeys,
  refusedLevels,
  type ComposableLevel,
  type Sender,
} from './mailbox';
import s from '../drawer.module.css';

export type { Sender };

export interface MailboxComposerProps {
  /**
   * The thread to append to. `null` ⇒ this drawer has not been told one, and the composer
   * renders **disabled with the reason** — the drawer's standing rule for a control that
   * cannot act, the same one `Take it ↓` and `▶ Run now` follow. It does not collapse:
   * collapsing is for a frontmatter section an agent did not fill in, and a missing address
   * is not a missing optional field.
   *
   * **This comment used to say `SseStartData` carries no `threadId`, and so did the sentence
   * on screen. Both were left behind by M17**, where the field landed
   * (`RUN_STREAM_CARRIES_THREAD_ID` is `true`) and `JobDrawer` began reading it. Two states
   * still reach `null` and neither is the wire's fault: no run has been started in this
   * drawer, or the runner has no thread store at all (`--profile dev`), where the id is
   * genuinely absent from a real `start`. `threads.mailbox.noThread` now reports the
   * observation rather than naming a cause that only one of the two shares.
   */
  threadId: string | null;
  send: Sender;
}

export function MailboxComposer({ threadId, send }: MailboxComposerProps) {
  const t = useT();
  const bodyId = useId();
  const groupName = useId();

  const [body, setBody] = useState('');
  const [level, setLevel] = useState<ComposableLevel>(DEFAULT_LEVEL);
  const [busy, setBusy] = useState(false);
  const [outcome, setOutcome] = useState<StringKey[] | null>(null);
  const [failure, setFailure] = useState<string | null>(null);

  const offered = composableLevels();
  const refused = refusedLevels();
  const addressable = threadId !== null;
  const sendable = addressable && !busy && canSend(body);

  const onSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (threadId === null || busy) return;
    if (!canSend(body)) {
      setOutcome(null);
      setFailure(t('threads.mailbox.emptyBody'));
      return;
    }
    setBusy(true);
    setFailure(null);
    setOutcome(null);
    send(threadId, { body, interrupt: level })
      .then((response) => {
        // The body is cleared rather than kept: it is now the runner's copy, and a
        // second submit of the same text would be a second turn nobody asked for.
        setBody('');
        setOutcome(
          outcomeKeys({
            disposition: response.disposition,
            threadState: response.threadState,
            interrupt: level,
          }),
        );
      })
      .catch((error: unknown) => {
        // The runner's sentence, verbatim, and never the body — see `postThreadMessage`.
        setFailure(error instanceof Error ? error.message : t('threads.mailbox.emptyBody'));
      })
      .finally(() => setBusy(false));
  };

  return (
    <form className={s.composer} onSubmit={onSubmit}>
      <label className={s.fieldLabel} htmlFor={bodyId}>
        {t('threads.mailbox.bodyLabel')}
      </label>
      <textarea
        id={bodyId}
        className={cx(s.control, s.textarea)}
        value={body}
        disabled={!addressable || busy}
        placeholder={t('threads.mailbox.bodyPlaceholder')}
        onChange={(event) => setBody(event.target.value)}
      />

      {/* Native radios, visually hidden inside their labels. A `role="radiogroup"` of
       * buttons would owe us arrow-key handling that has to mirror in RTL, and
       * `SegmentedControl` had that exact bug in the shell's primary navigation for a
       * day. The platform's radio group already keys in reading order in both
       * directions, for free and correctly. */}
      <fieldset className={s.composerLevels} disabled={!addressable || busy}>
        <legend className={s.srOnly}>{t('threads.mailbox.levelLabel')}</legend>
        {offered.map((option) => (
          <label key={option} className={s.composerLevel} data-active={option === level}>
            <input
              type="radio"
              className={s.srOnly}
              name={groupName}
              value={option}
              checked={option === level}
              onChange={() => setLevel(option)}
            />
            <InterruptBadge level={option} />
          </label>
        ))}
      </fieldset>

      {/* The third rung. `refusedLevels()` is derived from `STEER_DELIVERY`, so this
       * disappears on its own the day the runner can deliver a steer — and
       * `mailbox.test.ts` pins the set to exactly `['steer']`, so a second refused level
       * arriving cannot pass through here undrawn. */}
      {refused.includes('steer') ? (
        <p className={s.composerRefused}>
          <InterruptBadge level="steer" deliverable={false} />
          {/* aria-hidden: the badge already announces this exact sentence to a screen
           * reader. Same key, so the two cannot say different things. */}
          <span aria-hidden className={s.composerRefusedWhy}>
            {t('a11y.threads.interrupt.undeliverable')}
          </span>
        </p>
      ) : null}

      <div className={s.actions}>
        <Pill type="submit" variant="primary" disabled={!sendable}>
          {busy ? t('threads.mailbox.sending') : t('threads.mailbox.send')}
        </Pill>
      </div>

      {!addressable ? <p className={s.sectionNote}>{t('threads.mailbox.noThread')}</p> : null}

      {/* `aria-live`: the outcome is the answer to an action the reader just took, and it
       * arrives after focus has moved on. Polite, because nothing here is urgent. */}
      <div className={s.composerResult} role="status" aria-live="polite">
        {outcome?.map((key) => (
          <p key={key} className={s.sectionNote}>
            {t(key)}
          </p>
        ))}
        {failure ? <p className={s.fieldError}>{failure}</p> : null}
      </div>
    </form>
  );
}
