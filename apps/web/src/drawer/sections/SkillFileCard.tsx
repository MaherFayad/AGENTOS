'use client';

/**
 * §2.3 item 4 — the skill-file card, and the two buttons SkillTree does not have.
 *
 *   ⬇ 1 runnable skill file · yours to download      [ Take it ↓ ]
 *   [ ▶ Run now ]  [ (clock) Schedule ]
 *
 * `Take it ↓` downloads the SKILL.md folder as a zip. ▶ Run now and Schedule are the
 * reason this product exists (§3.2), so they are never decorative: each is either wired or
 * disabled **with the reason rendered as text under the row**.
 *
 * It used to say "in its tooltip", and it did exactly that: a correct, specific sentence in a
 * `title` and a 1×1 `sr-only` span. That reaches a hovering mouse and a screen reader and
 * nobody else — not a phone, which §3.6 makes the point of this PWA, and not a keyboard, where
 * `title` does not open on focus in any browser. `sections/InertReasons.tsx` carries the full
 * account and the measurements.
 *
 * The Schedule glyph is a **lucide `Clock`**, not U+23F0. That codepoint has no
 * text-presentation variant, so every platform paints it as a full-colour emoji that no
 * CSS `color` can reach — a saturated clock in monochrome chrome (§1.3, BOARD constraint 1).
 * `⬇` and `▶` are text-presentation by default and inherit `currentColor`, so they stay.
 * Asked for in `comms/inbox/_all/20260816-1235-orchestrator-clock-emoji-breaks-monochrome.md`.
 *
 * Owner: drawer-engineer
 */

import { useState } from 'react';
import { Clock } from 'lucide-react';
import { Pill } from '../primitives';
import { describeCron } from '../data/format';
import type { Capabilities } from '../run/useRunnerAvailability';
import s from '../drawer.module.css';
import { InertReasonNotes, useInertReasons } from './InertReasons';

/**
 * Hoisted out of the `title=` it used to be typed into, so that one sentence can be both the
 * hover text and the visible paragraph. Two spellings of a reason is one edit away from a
 * tooltip and a note that disagree.
 */
const DOWNLOAD_REASON =
  'The download route is not agreed with the runner yet, so this would 404. It turns on with GET /api/agents/:slug/download.';

export function SkillFileCard({
  fileCount,
  downloadHref,
  capabilities,
  schedule,
  onRun,
  onSchedule,
  running,
  scheduleBusy,
  scheduleResult,
}: {
  fileCount: number;
  /** `null` when the URL names no project (M15) — there is no address to link at. */
  downloadHref: string | null;
  capabilities: Capabilities;
  /** The agent's current cron, from frontmatter. Prefills the schedule field. */
  schedule: string | null;
  onRun: () => void;
  onSchedule: (cron: string) => void;
  running: boolean;
  scheduleBusy: boolean;
  /** A sentence from the last schedule attempt, success or failure. */
  scheduleResult: string | null;
}) {
  const [editing, setEditing] = useState(false);
  const [cron, setCron] = useState(schedule ?? '');

  const runnerReady = capabilities.runner === 'ready';
  const inWords = describeCron(schedule);
  const canDownload = capabilities.download && downloadHref !== null;
  /**
   * Two reasons, not one, and in the order the buttons appear. `Take it ↓` is disabled by an
   * unagreed route; `▶ Run now` and `⏰ Schedule` by whatever `GET /api/status` said. They are
   * separate facts with separate fixes, and one merged sentence would have said "the runner
   * is down" about a button that stays disabled with it up.
   */
  const inert = useInertReasons([
    canDownload ? null : DOWNLOAD_REASON,
    runnerReady ? null : capabilities.reason,
  ]);

  return (
    <div className={s.skillCard}>
      <p className={s.skillCardLine}>
        ⬇ {fileCount} runnable skill {fileCount === 1 ? 'file' : 'files'} · yours to download
      </p>
      {/* What the file says, and what acts on it — which is nothing.
        *
        * This read `Scheduled: {inWords}.`, which is the same rule 9 defect the save
        * sentence carried: `schedule:` in frontmatter is a *declaration*, and calling it
        * "scheduled" asserts that something reads it on a timer. Nothing does — the cron
        * sidecar left `infra/compose.yaml` at `e4e0bff` and the coordinator's plane records
        * fires rather than starting runs (`ScheduleResponse.firedBy` is `'nobody'`). Unlike
        * the save reply there is no server sentence to render here, because nothing was
        * posted: this is frontmatter the drawer already had. So it states the declaration
        * and names its absent executor in the same breath. */}
      {inWords ? (
        <p className={s.sectionNote}>
          Its file asks for {inWords}. Nothing in this build acts on that yet.
        </p>
      ) : null}

      <div className={s.actions}>
        {canDownload ? (
          // A real <a download>, not a button with a click handler: it must survive
          // middle-click, right-click-save and a long-press on a phone. `Pill` is
          // button-only today (design-system-guardian owns it — an `as` prop is requested
          // in their inbox), so this borrows the pill's shape from the stylesheet.
          <a className={s.linkPill} href={downloadHref} download title="Download this agent’s folder as a zip">
            Take it ↓
          </a>
        ) : (
          // The `title` stays for the mouse. What changed is that it is no longer the ONLY
          // carrier: `aria-describedby` points at the visible paragraph below, which every
          // reader gets — including the phone, which `title` has never reached.
          <span className={s.disabledAction} title={DOWNLOAD_REASON}>
            <Pill variant="secondary" disabled aria-describedby={inert.idFor(DOWNLOAD_REASON)}>
              Take it ↓
            </Pill>
          </span>
        )}

        {runnerReady ? (
          <Pill
            variant="primary"
            onClick={onRun}
            disabled={running}
            title={running ? 'This agent is running now.' : 'Run this agent now'}
          >
            {running ? '▶ Running…' : '▶ Run now'}
          </Pill>
        ) : (
          // Disabled Pill sets pointer-events-none, so the hover text still needs a carrier.
          // What the carrier no longer has is `tabIndex={0}`: it was there to make the reason
          // reachable by keyboard, and it never was — `title` does not open on focus in any
          // browser, so the only observable effect of that stop was that it existed. Measured
          // with real Tab key events, not `.focus()`, which does not even match
          // `:focus-visible`.
          <span className={s.disabledAction} title={capabilities.reason ?? undefined}>
            <Pill variant="primary" disabled aria-describedby={inert.idFor(capabilities.reason)}>
              ▶ Run now
            </Pill>
          </span>
        )}

        {runnerReady ? (
          <Pill
            variant="secondary"
            onClick={() => setEditing((open) => !open)}
            title="Set a cron schedule for this agent"
            leading={<Clock size={12} aria-hidden="true" />}
          >
            Schedule
          </Pill>
        ) : (
          <span className={s.disabledAction} title={capabilities.reason ?? undefined}>
            <Pill
              variant="secondary"
              disabled
              aria-describedby={inert.idFor(capabilities.reason)}
              leading={<Clock size={12} aria-hidden="true" />}
            >
              Schedule
            </Pill>
          </span>
        )}
      </div>

      <InertReasonNotes notes={inert.notes} />

      {editing && runnerReady ? (
        <div className={`${s.field} ${s.fieldBlock}`}>
          <label className={s.fieldLabel} htmlFor="drawer-cron">
            Cron — five fields, minute hour day month weekday
          </label>
          <input
            id="drawer-cron"
            className={s.control}
            value={cron}
            onChange={(event) => setCron(event.target.value)}
            placeholder="0 6 * * 1"
            spellCheck={false}
          />
          {describeCron(cron) ? <p className={s.sectionNote}>That is {describeCron(cron)}.</p> : null}
          <div className={s.actions}>
            <Pill variant="primary" onClick={() => onSchedule(cron.trim())} disabled={cron.trim() === '' || scheduleBusy}>
              {scheduleBusy ? 'Saving…' : 'Save schedule'}
            </Pill>
            <Pill variant="ghost" onClick={() => setEditing(false)}>
              Cancel
            </Pill>
          </div>
        </div>
      ) : null}

      {scheduleResult ? <p className={s.sectionNote}>{scheduleResult}</p> : null}
    </div>
  );
}
