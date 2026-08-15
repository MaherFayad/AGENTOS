'use client';

/**
 * The two pieces §2.6.5 has that §2.3 does not: the autonomy toggle row under the title,
 * and the SKILLS cards.
 *
 * **The toggle row is a readout, not a control.** `tier` lives in frontmatter, so changing
 * it means a git commit through the runner (§3.2's schedule route does the same thing for
 * `schedule:`). Until that route exists the row shows which of the three states this agent
 * is in and says why it can't be changed here — rather than offering a switch that throws
 * the value away on the next page load.
 *
 * SKILLS cards carry `Read →` and `Download ⬇` in the original; ours adds **Run**.
 * Sub-skills declared in `breaks_into` are leaf skill files, not necessarily full agents
 * (frontmatter-schema invariant 4), so a card only offers what the entry actually resolves
 * to — no dead buttons.
 *
 * Owner: drawer-engineer
 */

import { Pill } from '../primitives';
import { TIER_LABEL, TIER_ORDER, type SkillRef } from '../data/project';
import type { Capabilities } from '../run/useRunnerAvailability';
import type { Tier } from '../data/types';
import s from '../drawer.module.css';

const TIER_EXPLAIN = 'This is where the agent runs today. Moving it commits a change to its SKILL.md, which the runner owns.';

export function AutonomyToggleRow({ tier }: { tier: Tier }) {
  return (
    <div className={s.toggleRow} role="group" aria-label="Autonomy state">
      {TIER_ORDER.map((candidate) => (
        <button
          key={candidate}
          type="button"
          className={s.toggle}
          data-active={candidate === tier ? 'true' : 'false'}
          aria-pressed={candidate === tier}
          disabled
          title={TIER_EXPLAIN}
        >
          {TIER_LABEL[candidate]}
        </button>
      ))}
    </div>
  );
}

export function SkillCards({
  skills,
  capabilities,
  onRead,
  onRun,
}: {
  skills: SkillRef[];
  capabilities: Capabilities;
  onRead: (skill: SkillRef) => void;
  onRun: (skill: SkillRef) => void;
}) {
  return (
    <div className={s.skillCards}>
      {skills.map((skill) => {
        const isAgent = Boolean(skill.agentSlug);
        return (
          <div className={s.skillEntry} key={skill.nodeId}>
            <p className={s.skillName}>{skill.label}</p>
            {skill.description ? <p className={s.skillDescription}>{skill.description}</p> : null}
            <div className={s.skillActions}>
              <Pill
                variant="ghost"
                onClick={() => onRead(skill)}
                disabled={!isAgent}
                title={
                  isAgent
                    ? `Open ${skill.label}`
                    : 'This skill is a file inside the agent’s own folder, so there is no separate page to open yet.'
                }
              >
                Read →
              </Pill>
              <Pill
                variant="ghost"
                disabled={!capabilities.download}
                title={
                  capabilities.download
                    ? `Download ${skill.label}`
                    : 'The download route is not agreed with the runner yet, so this would 404.'
                }
              >
                Download ⬇
              </Pill>
              <Pill
                variant="secondary"
                onClick={() => onRun(skill)}
                disabled={!isAgent || capabilities.runner !== 'ready'}
                title={
                  !isAgent
                    ? 'Only a full agent can be run on its own; this is one step inside one.'
                    : (capabilities.reason ?? `Run ${skill.label}`)
                }
              >
                ▶ Run
              </Pill>
            </div>
          </div>
        );
      })}
    </div>
  );
}
