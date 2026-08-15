'use client';

/**
 * The live run console — our addition to §2.3. Monospace 12px on --screen, sliding up over
 * the drawer while a run streams, and sliding back down when it is finished with.
 *
 * It renders exactly the events in `comms/contracts/api-contracts.md` and says so out loud
 * when it is handed one it does not know (the reducer turns that into a notice line).
 *
 * Two things here are not cosmetic:
 *
 *  - **Windowing.** The reducer keeps at most MAX_LINES (~2k) and counts what it dropped;
 *    this component paints only the tail of that window. A long run therefore has a bounded
 *    DOM instead of a browser tab that dies at hour three, and the count of dropped lines
 *    is shown rather than hidden.
 *  - **The approval gate (§3.2).** When the runner emits `plan` the run is *paused*. The
 *    console stops claiming to stream, and the copper Allow / Deny cards appear. Nothing
 *    resumes until `POST /api/approvals/:runId` answers.
 *
 * Owner: drawer-engineer
 */

import { useEffect, useRef } from 'react';
import { Pill } from '../primitives';
import { formatCost, formatDuration } from '../data/format';
import type { ConsoleState } from '../run/console-model';
import s from '../drawer.module.css';

/** How many lines are painted. The reducer's cap is the memory bound; this is the DOM bound. */
export const VISIBLE_LINES = 400;

export function RunConsole({
  state,
  open,
  onDecide,
  onCancel,
  onDismiss,
}: {
  state: ConsoleState;
  open: boolean;
  onDecide: (decision: 'approve' | 'deny') => void;
  onCancel: () => void;
  onDismiss: () => void;
}) {
  const linesRef = useRef<HTMLDivElement | null>(null);
  const count = state.lines.length;

  // Follow the tail while new output arrives.
  useEffect(() => {
    const node = linesRef.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [count, open]);

  const visible = state.lines.length > VISIBLE_LINES ? state.lines.slice(-VISIBLE_LINES) : state.lines;
  const hidden = state.trimmed + (state.lines.length - visible.length);

  const cost = formatCost(state.costUsd);
  const duration = formatDuration(state.durationMs);
  const streaming = state.phase === 'connecting' || state.phase === 'streaming';
  const paused = state.phase === 'awaiting-approval';

  return (
    <div className={s.console} data-state={open ? 'open' : 'closed'} aria-hidden={open ? undefined : true}>
      <div className={s.consoleHead}>
        <span className={s.consoleTitle}>{paused ? 'Waiting on you' : streaming ? 'Running' : 'Run output'}</span>
        {streaming || paused ? (
          <Pill variant="ghost" onClick={onCancel}>
            Stop
          </Pill>
        ) : (
          <Pill variant="ghost" onClick={onDismiss}>
            Close output
          </Pill>
        )}
      </div>

      {paused && state.plan ? (
        <div className={s.approval}>
          <p className={s.approvalLabel}>Approval required</p>
          <p className={s.approvalPlan}>{state.plan}</p>
          <div className={s.approvalActions}>
            <Pill variant="primary" onClick={() => onDecide('approve')}>
              Allow
            </Pill>
            <Pill variant="secondary" onClick={() => onDecide('deny')}>
              Deny
            </Pill>
          </div>
        </div>
      ) : null}

      <div className={s.consoleLines} ref={linesRef} role="log" aria-live="polite" aria-label="Run output">
        {hidden > 0 ? <p className={s.consoleTrimmed}>{hidden} earlier lines are no longer held in the browser.</p> : null}
        {visible.length === 0 && !paused ? (
          <p className={s.consoleTrimmed}>Nothing has come back from the runner yet.</p>
        ) : null}
        {visible.map((line) => (
          <div className={s.consoleLine} key={line.id} data-kind={line.kind} data-tone={line.tone}>
            {line.href ? (
              <a href={line.href} target="_blank" rel="noreferrer">
                {line.text}
              </a>
            ) : (
              line.text
            )}
          </div>
        ))}
      </div>

      <div className={s.consoleFoot}>
        <span>
          {state.runId ? `Run ${state.runId}` : 'No run id yet'}
          {cost ? ` · ${cost}` : ''}
          {duration ? ` · ${duration}` : ''}
        </span>
        {state.traceUrl ? (
          <a href={state.traceUrl} target="_blank" rel="noreferrer">
            Trace →
          </a>
        ) : null}
      </div>
    </div>
  );
}
