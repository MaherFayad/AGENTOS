import type { KeyboardEventHandler } from 'react';
import { HATCH_STYLE } from '../model/hatch';

export interface EmptyCellProps {
  /** Focus target id, from `posId()` — the cell participates in keyboard traversal. */
  id: string;
  /** Roving tabindex: 0 for the one focused cell, -1 for the rest. */
  tabIndex: number;
  /** e.g. "Human-assisted — AI drafts, a human approves". */
  tierLabel: string;
  /** e.g. "4 Orchestrate — Agents, monitoring, loops". */
  phaseLabel: string;
  onFocus?: () => void;
  onKeyDown?: KeyboardEventHandler<HTMLDivElement>;
}

/**
 * §2.6.6 — an empty tier × phase renders as a diagonal-hatch block.
 *
 * This is a *statement*, not a placeholder: nothing has been deployed at that combination
 * yet. It stays focusable and announces itself, because "nothing here yet" is one of the
 * more useful things a rollout board can tell you.
 */
export function EmptyCell({
  id,
  tabIndex,
  tierLabel,
  phaseLabel,
  onFocus,
  onKeyDown,
}: EmptyCellProps) {
  return (
    <div
      id={id}
      data-empty="true"
      data-testid="chart-empty-cell"
      tabIndex={tabIndex}
      onFocus={onFocus}
      onKeyDown={onKeyDown}
      aria-label={`No jobs yet · ${tierLabel} · ${phaseLabel}`}
      style={HATCH_STYLE}
      className="h-full min-h-[64px] w-full rounded-[10px] opacity-60 outline-none focus-visible:opacity-100 focus-visible:ring-1 focus-visible:ring-line-2"
    />
  );
}
