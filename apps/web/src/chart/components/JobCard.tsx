'use client';

import type { KeyboardEventHandler } from 'react';
import { phaseColumn } from '../model/taxonomy';
import type { ChartAgent } from '../types';
import { Chip, CHART_MOTION } from '../ui';
import { IconSquare } from './JobIcon';
import { PhaseDots } from './PhaseDots';

export interface JobCardProps {
  agent: ChartAgent;
  /** Focus target id from `posId()`. */
  id: string;
  tabIndex: number;
  expanded: boolean;
  onToggle: () => void;
  /** §2.6.5 — hands the selection to `drawer-engineer`'s right drawer. */
  onMoreDetail: () => void;
  onFocus?: () => void;
  onKeyDown?: KeyboardEventHandler<HTMLElement>;
}

/**
 * §2.6.4 — icon square + name 13px/600 + phase tag with tier dots + expand chevron.
 * Hover raises the card to `--card-2`. Expanded reveals the description, the SKILLS chips
 * and `More detail →`.
 *
 * The card face is one real `<button>` (so Enter and Space expand it for free and screen
 * readers get `aria-expanded`), and `More detail` is a second real button — never a div
 * with a click handler.
 */
export function JobCard({
  agent,
  id,
  tabIndex,
  expanded,
  onToggle,
  onMoreDetail,
  onFocus,
  onKeyDown,
}: JobCardProps) {
  const phase = phaseColumn(agent.phase);
  const panelId = `${id}-panel`;

  return (
    <div
      data-testid="chart-job-card"
      data-slug={agent.slug}
      data-expanded={expanded}
      className="group rounded-card-sm border border-line bg-card transition-colors hover:border-line-2 hover:bg-card-2 focus-within:border-line-2"
    >
      <button
        type="button"
        id={id}
        tabIndex={tabIndex}
        aria-expanded={expanded}
        aria-controls={expanded ? panelId : undefined}
        onClick={onToggle}
        onFocus={onFocus}
        onKeyDown={onKeyDown}
        className="flex w-full items-start gap-2 rounded-card-sm px-2 py-2 text-left outline-none focus-visible:ring-1 focus-visible:ring-line-2"
      >
        <IconSquare name={agent.icon} />

        <span className="min-w-0 flex-1">
          <span className="block truncate text-small font-semibold leading-tight text-ivory">
            {agent.name}
          </span>
          <span className="mt-1 flex items-center gap-1.5 text-label-sm uppercase text-ink-2">
            <span>{phase.tag}</span>
            <PhaseDots ordinal={phase.ordinal} />
          </span>
        </span>

        <Chevron expanded={expanded} />
      </button>

      {expanded && (
        <div
          id={panelId}
          data-testid="chart-job-card-panel"
          style={{
            animation: `chart-reveal ${CHART_MOTION.expandMs}ms ${CHART_MOTION.ease} both`,
          }}
          className="border-t border-line px-2 pb-2 pt-2"
        >
          <p className="text-meta text-ivory-2">{agent.description}</p>

          {agent.skills.length > 0 && (
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <span className="text-label-sm uppercase text-ink-3">
                Skills
              </span>
              {agent.skills.map((skill) => (
                <Chip key={skill}>{skill}</Chip>
              ))}
            </div>
          )}

          <button
            type="button"
            onClick={onMoreDetail}
            className="mt-2.5 text-chip font-semibold text-ivory underline-offset-4 outline-none hover:underline focus-visible:underline"
          >
            More detail →
          </button>
        </div>
      )}
    </div>
  );
}

function Chevron({ expanded }: { expanded: boolean }) {
  return (
    <svg
      aria-hidden="true"
      data-testid="chart-chevron"
      width="12"
      height="12"
      viewBox="0 0 12 12"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`mt-1 shrink-0 text-ink-3 transition-transform ${expanded ? 'rotate-180' : ''}`}
    >
      <path d="M3 4.5 6 7.5 9 4.5" />
    </svg>
  );
}
