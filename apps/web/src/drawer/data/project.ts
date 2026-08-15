/**
 * The projection: frontmatter -> drawer view model (Part IV, §2.3, §2.6.5).
 *
 * Both drawers render this one model. Nothing below reads an agent name or writes a
 * per-agent string: if a sentence is about an agent, it came out of that agent's
 * frontmatter. The only strings authored here are section labels and the small connective
 * copy that is identical for all 150 agents — the same status as a column header.
 *
 * Collapse rule (§2.3): a section with nothing to say returns `null` and is not rendered.
 * No empty headers, no "N/A", no "—".
 *
 * Owner: drawer-engineer
 */

import { findDepartment } from '@agnetos/contracts/departments';
import { describeCron, labelFromSlug } from './format';
import { planInputs, type InputPlan } from './inputs';
import type { AgentDoc, Tier } from './types';

/** Display labels for the three autonomy states (§2.3 item 9, §2.6.5 ladder). */
export const TIER_LABEL: Record<Tier, string> = {
  'human-led': 'HUMAN-LED',
  assisted: 'HUMAN-ASSISTED',
  autonomous: 'FULLY AUTONOMOUS',
};

export const TIER_ORDER: Tier[] = ['human-led', 'assisted', 'autonomous'];

export interface ChipRef {
  /** What the chip says. */
  label: string;
  /** The raw frontmatter entry. */
  slug: string;
  /** The graph node id to fly to (contracts/graph-layout.md ids are `department/agent`). */
  nodeId: string;
  /** Set when the entry resolves to a full agent the drawer can open. */
  agentSlug?: string;
  department: string;
}

export interface LadderRow {
  tier: Tier;
  label: string;
  text: string;
  active: boolean;
}

export interface SkillRef extends ChipRef {
  /** §2.6.5 SKILLS cards want a description. Sub-skill files don't carry one yet. */
  description?: string;
}

export interface DrawerModel {
  slug: string;
  department: string;
  /** §2.3 item 1 — autonomy state, e.g. `FULLY AUTONOMOUS`. */
  eyebrow: string;
  /**
   * §2.6.5 item 1 — the chart drawer's eyebrow is the cluster (`COMPANIES` in the video),
   * not the tier: the chart already carries autonomy in its rows.
   */
  clusterEyebrow: string;
  tier: Tier;
  /** §2.3 item 2. */
  title: string;
  breadcrumb: string | null;
  /** §2.3 item 3. */
  description: string | null;
  /** §2.3 item 4 — the count is data; the sentence around it is chrome. */
  skillFileCount: number;
  /** §2.3 item 5. */
  breaksInto: ChipRef[];
  /** §2.3 item 6. */
  wiredInto: string[];
  /** §2.3 item 7. */
  buildsOn: ChipRef[];
  /** §2.3 item 8 / §2.6.5 REPLACES. */
  replaces: string | null;
  /** §2.3 item 9 / §2.6.5 FROM MANUAL TO AUTONOMOUS. */
  ladder: LadderRow[];
  /** §2.3 item 10. */
  theHuman: string | null;
  /** Our addition — INPUTS. */
  inputs: InputPlan;
  /** §2.6.5 SKILLS cards. */
  skills: SkillRef[];
  /** §2.6.5 HOW TO RUN IT. */
  howToRun: string | null;
  schedule: string | null;
  scheduleInWords: string | null;
  approvalRequired: boolean;
  /**
   * `wired_into` names with no connector wired, as the *runner* resolved them
   * (`AgentDetail.runnable`). `undefined` when the runner did not say — never inferred
   * as `[]`, because an inferred empty list reads as "everything is wired".
   */
  missingConnectors: string[] | undefined;
  deliverTo: string | null;
  status: string | null;
}

function trimmed(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

/**
 * A `breaks_into` entry is a leaf skill file inside the agent's own folder unless it
 * already carries a path (frontmatter-schema invariant 4). A `builds_on` entry is a
 * sibling agent in the same department (invariant 3).
 */
export function resolveLeafId(entry: string, agentSlug: string): string {
  return entry.includes('/') ? entry : `${agentSlug}/${entry}`;
}

export function resolveAgentId(entry: string, department: string): string {
  return entry.includes('/') ? entry : `${department}/${entry}`;
}

/** Tool/MCP names are lowercase slugs in frontmatter; `WIRED INTO` shows them as names. */
export function toolLabels(wiredInto: string[] | undefined): string[] {
  return (wiredInto ?? []).filter((t) => typeof t === 'string' && t.length > 0).map(labelFromSlug);
}

export function projectAgent(doc: AgentDoc): DrawerModel {
  const fm = doc.frontmatter;
  const department = fm.department;
  const departmentLabel = findDepartment(department)?.label ?? labelFromSlug(department);
  const clusterLabel = fm.cluster ? labelFromSlug(fm.cluster) : null;

  const breaksInto: ChipRef[] = (fm.breaks_into ?? [])
    .filter((entry) => typeof entry === 'string' && entry.length > 0)
    .map((entry) => ({
      label: labelFromSlug(entry),
      slug: entry,
      nodeId: resolveLeafId(entry, doc.slug),
      agentSlug: entry.includes('/') ? entry : undefined,
      department,
    }));

  const buildsOn: ChipRef[] = (fm.builds_on ?? [])
    .filter((entry) => typeof entry === 'string' && entry.length > 0)
    .map((entry) => {
      const agentSlug = resolveAgentId(entry, department);
      return { label: labelFromSlug(entry), slug: entry, nodeId: agentSlug, agentSlug, department };
    });

  const ladder: LadderRow[] = TIER_ORDER.map((tier) => ({
    tier,
    label: TIER_LABEL[tier],
    text: trimmed(fm.ladder?.[tier]) ?? '',
    active: fm.tier === tier,
  })).filter((row) => row.text.length > 0 || row.active);

  return {
    slug: doc.slug,
    department,
    tier: fm.tier,
    eyebrow: TIER_LABEL[fm.tier],
    // §2.6.5's eyebrow is the cluster (the video shows `COMPANIES`), because the chart
    // already carries autonomy in its rows and repeating it there wastes the one line of
    // context the panel has. With no cluster it falls back to the department — never to
    // an empty strip.
    clusterEyebrow: (clusterLabel ?? departmentLabel).toUpperCase(),
    title: fm.name,
    breadcrumb: [departmentLabel, clusterLabel].filter(Boolean).join(' · ') || null,
    description: trimmed(fm.description),
    skillFileCount: 1,
    breaksInto,
    wiredInto: toolLabels(fm.wired_into),
    buildsOn,
    replaces: trimmed(fm.replaces),
    ladder: ladder.length > 0 ? ladder : [],
    theHuman: trimmed(fm.the_human),
    inputs: planInputs(fm.inputs),
    skills: breaksInto.map((chip) => ({ ...chip })),
    howToRun: composeHowToRun(doc),
    schedule: trimmed(fm.schedule),
    scheduleInWords: describeCron(fm.schedule),
    approvalRequired: doc.runnable?.approvalRequired === true || fm.approval === 'required',
    missingConnectors: doc.runnable?.missingConnectors,
    deliverTo: trimmed(fm.deliver?.slack) ?? trimmed(fm.deliver?.email),
    status: trimmed(fm.status),
  };
}

/**
 * §2.6.5 `HOW TO RUN IT`.
 *
 * The schema has no `how_to_run:` field and this file does not invent one. The paragraph
 * is *assembled from facts that are already in the frontmatter* — what it asks you for,
 * when it runs itself, whether it waits for you, what it is allowed to touch, where the
 * output goes. Every noun in the sentence came out of the agent's own file; only the
 * grammar joining them is authored, and that grammar is identical for all 150 agents, the
 * same status as a column header (Part IV).
 *
 * With none of those facts present the section collapses rather than saying something
 * generic and true of nothing.
 */
export function composeHowToRun(doc: AgentDoc): string | null {
  const fm = doc.frontmatter;
  const rest: string[] = [];
  const cron = describeCron(fm.schedule);
  if (cron) rest.push(`It also runs itself ${cron}.`);
  if (fm.approval === 'required') rest.push('It stops at its plan and waits for you to approve before it acts.');
  const tools = toolLabels(fm.wired_into);
  if (tools.length > 0) rest.push(`It may use ${tools.join(' and ')} — and nothing else.`);
  const target = trimmed(fm.deliver?.slack) ?? trimmed(fm.deliver?.email);
  if (target) rest.push(`The result is delivered to ${target}.`);

  const { fields } = planInputs(fm.inputs);
  if (fields.length === 0 && rest.length === 0) return null;

  const opening =
    fields.length > 0
      ? `Give it ${listOf(fields.map((f) => f.label.toLowerCase()))}, then press Run now.`
      : 'Press Run now — it asks you for nothing first.';

  return [opening, ...rest].join(' ');
}

function listOf(items: string[]): string {
  if (items.length === 1) return items[0];
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}
