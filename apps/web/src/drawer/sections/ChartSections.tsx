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
 * "Says why" was a `title`, which is to say it did not say why to anyone on a phone or a
 * keyboard: three disabled pills shaped exactly like a working segmented control, one styled
 * active, and no words. Both halves of this file now render their reason as text
 * (`sections/InertReasons.tsx`).
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
import { InertReasonNotes, useInertReasons } from './InertReasons';

const TIER_EXPLAIN = 'This is where the agent runs today. Moving it commits a change to its SKILL.md, which the runner owns.';

/**
 * The three sentences the SKILLS cards can be disabled by. Hoisted out of the `title=`
 * expressions they were written into so that one string is both the hover text and the
 * paragraph, and so that the **permanent** ones are visibly separate from the transient one.
 *
 * `NOT_AN_AGENT_*` are facts about a sub-skill and never turn on. `DOWNLOAD_NOT_AGREED` turns
 * on the day `runner-engineer` answers the open route request. The runner's own reason, when
 * it is down, arrives from `capabilities.reason`. Four different fixes, four different
 * sentences, and this is exactly why one collapsed line would have been a lie.
 */
const NOT_AN_AGENT_READ =
  'This skill is a file inside the agent’s own folder, so there is no separate page to open yet.';
const NOT_AN_AGENT_RUN = 'Only a full agent can be run on its own; this is one step inside one.';
const DOWNLOAD_NOT_AGREED = 'The download route is not agreed with the runner yet, so this would 404.';

export function AutonomyToggleRow({ tier }: { tier: Tier }) {
  // One reason, three pills. Without it this row is a segmented control that does not
  // respond and says nothing — the worst-worded of the sixteen, because the other fifteen
  // at least *look* disabled while this one has an active-looking copper segment.
  const inert = useInertReasons([TIER_EXPLAIN]);
  return (
    <>
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
            // On every pill and not once on the group: the sweep in
            // `inert-reasons.test.tsx` asks each disabled CONTROL for its description, and a
            // description hung on an ancestor is one a control cannot be asked for.
            aria-describedby={inert.idFor(TIER_EXPLAIN)}
          >
            {TIER_LABEL[candidate]}
          </button>
        ))}
      </div>
      <InertReasonNotes notes={inert.notes} />
    </>
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
      {skills.map((skill) => (
        <SkillCard
          key={skill.nodeId}
          skill={skill}
          capabilities={capabilities}
          onRead={onRead}
          onRun={onRun}
        />
      ))}
    </div>
  );
}

/**
 * One card, extracted so each can hold its own reason list — the three buttons on a *file*
 * card are dead for two permanent reasons, and on an *agent* card for one transient one.
 * A single list hoisted to the group would have had to pick, and picking is how "the runner
 * is down" ends up printed under a button that stays disabled with it up.
 */
function SkillCard({
  skill,
  capabilities,
  onRead,
  onRun,
}: {
  skill: SkillRef;
  capabilities: Capabilities;
  onRead: (skill: SkillRef) => void;
  onRun: (skill: SkillRef) => void;
}) {
  const isAgent = Boolean(skill.agentSlug);
  const runnerReason = capabilities.runner === 'ready' ? null : capabilities.reason;
  const readReason = isAgent ? null : NOT_AN_AGENT_READ;
  const downloadReason = capabilities.download ? null : DOWNLOAD_NOT_AGREED;
  // A sub-skill is refused for what it is before the runner is ever consulted, and that is
  // the order the button's own `title` already used. The note must agree with it.
  const runReason = isAgent ? runnerReason : NOT_AN_AGENT_RUN;
  const inert = useInertReasons([readReason, downloadReason, runReason]);

  return (
    <div className={s.skillEntry}>
      <p className={s.skillName}>{skill.label}</p>
      {skill.description ? <p className={s.skillDescription}>{skill.description}</p> : null}
      <div className={s.skillActions}>
        <Pill
          variant="ghost"
          onClick={() => onRead(skill)}
          disabled={!isAgent}
          title={isAgent ? `Open ${skill.label}` : NOT_AN_AGENT_READ}
          aria-describedby={inert.idFor(readReason)}
        >
          Read →
        </Pill>
        <Pill
          variant="ghost"
          disabled={!capabilities.download}
          title={capabilities.download ? `Download ${skill.label}` : DOWNLOAD_NOT_AGREED}
          aria-describedby={inert.idFor(downloadReason)}
        >
          Download ⬇
        </Pill>
        <Pill
          variant="secondary"
          onClick={() => onRun(skill)}
          disabled={!isAgent || capabilities.runner !== 'ready'}
          title={runReason ?? `Run ${skill.label}`}
          aria-describedby={inert.idFor(runReason)}
        >
          ▶ Run
        </Pill>
      </div>
      <InertReasonNotes notes={inert.notes} />
    </div>
  );
}
