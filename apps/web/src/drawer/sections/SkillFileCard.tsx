'use client';

/**
 * §2.3 item 4 — the skill-file card, and the two buttons SkillTree does not have.
 *
 *   ⬇ 1 runnable skill file · yours to download      [ Take it ↓ ]
 *   [ ▶ Run now ]  [ ⏰ Schedule ]
 *
 * `Take it ↓` downloads the SKILL.md folder as a zip. ▶ Run now and ⏰ Schedule are the
 * reason this product exists (§3.2), so they are never decorative: each is either wired or
 * disabled with the reason in its tooltip.
 *
 * Owner: drawer-engineer
 */

import { useState } from 'react';
import { Pill } from '../primitives';
import { describeCron } from '../data/format';
import type { Capabilities } from '../run/useRunnerAvailability';
import s from '../drawer.module.css';

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
  downloadHref: string;
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

  return (
    <div className={s.skillCard}>
      <p className={s.skillCardLine}>
        ⬇ {fileCount} runnable skill {fileCount === 1 ? 'file' : 'files'} · yours to download
      </p>
      {inWords ? <p className={s.sectionNote}>Scheduled: {inWords}.</p> : null}

      <div className={s.actions}>
        {capabilities.download ? (
          // A real <a download>, not a button with a click handler: it must survive
          // middle-click, right-click-save and a long-press on a phone. `Pill` is
          // button-only today (design-system-guardian owns it — an `as` prop is requested
          // in their inbox), so this borrows the pill's shape from the stylesheet.
          <a className={s.linkPill} href={downloadHref} download title="Download this agent’s folder as a zip">
            Take it ↓
          </a>
        ) : (
          <Pill
            variant="secondary"
            disabled
            title="The download route is not agreed with the runner yet, so this would 404. It turns on with GET /api/agents/:slug/download."
          >
            Take it ↓
          </Pill>
        )}

        <Pill
          variant="primary"
          onClick={onRun}
          disabled={!runnerReady || running}
          title={running ? 'This agent is running now.' : (capabilities.reason ?? 'Run this agent now')}
        >
          {running ? '▶ Running…' : '▶ Run now'}
        </Pill>

        <Pill
          variant="secondary"
          onClick={() => setEditing((open) => !open)}
          disabled={!runnerReady}
          title={capabilities.reason ?? 'Set a cron schedule for this agent'}
        >
          ⏰ Schedule
        </Pill>
      </div>

      {editing && runnerReady ? (
        <div className={`${s.field} ${s.fieldBlock}`}>
          <label className={s.fieldLabel} htmlFor="drawer-cron">
            Cron — five fields, the same syntax ofelia reads
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
