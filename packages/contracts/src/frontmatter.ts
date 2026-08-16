/**
 * Agent frontmatter — the single source of truth for MAP, CHART and DASHBOARDS.
 *
 * Spec: Part IV (data model), §2.1/§2.2 (map projection), §2.3 (drawer), §2.6 (chart
 * projection). Prose contract: comms/contracts/frontmatter-schema.md — that file is
 * normative, this one is hand-derived from it, and scripts/validate-frontmatter.mjs
 * checks that the two agree (ADR-002).
 *
 * One agent = one folder = agents/{department}/{agent-slug}/SKILL.md.
 * No view stores its own copy of agent data. If a view needs a fact, the fact is a field
 * here — never a hardcoded list in a component.
 *
 * Owner: agent-library-curator. Changing a field is an ADR + a broadcast + a validator
 * update, in that order (cc-frontmatter, "Changing the schema").
 */

import { z } from 'zod';

/* ------------------------------------------------------------------ *
 * Enums — ADR-001 and Part IV
 * ------------------------------------------------------------------ */

/**
 * The seven canonical departments, in ADR-001 order. Order is significant: it is the
 * CHART tab order (§2.6.1) and the MAP branch angle order (index × 360/7 starting at
 * −90°, so `sales` sits at twelve o'clock).
 *
 * Nothing else in the codebase may hardcode a department name. `departments.ts` (the
 * angle/rail table) imports this array rather than restating it.
 */
export const DEPARTMENTS = [
  'sales',
  'deals',
  'marketing',
  'operations',
  'intelligence',
  'customer',
  'back-office',
] as const;
export type Department = (typeof DEPARTMENTS)[number];

/** Display labels. `back-office` is the slug and path segment; `Back Office` is the label. */
export const DEPARTMENT_LABELS: Record<Department, string> = {
  sales: 'Sales',
  deals: 'Deals',
  marketing: 'Marketing',
  operations: 'Operations',
  intelligence: 'Intelligence',
  customer: 'Customer',
  'back-office': 'Back Office',
};

/** CHART rows (§2.6.3) and the drawer eyebrow (§2.3.1). Also the three `ladder` keys. */
export const TIERS = ['human-led', 'assisted', 'autonomous'] as const;
export type Tier = (typeof TIERS)[number];

/** CHART columns (§2.6.3) and the phase tag on a job card (§2.6.4). */
export const PHASES = ['1-foundation', '2-capture', '3-generate', '4-orchestrate'] as const;
export type Phase = (typeof PHASES)[number];

/**
 * Map halo + the "N OF 22 LIVE" counter (§2.1, §2.2).
 * `live` is set by observability/agent-auditor from real runs — never by hand. A
 * hand-set `live` makes the counter lie, and the counter is the credibility of the map.
 */
export const STATUSES = ['live', 'draft', 'failing'] as const;
export type Status = (typeof STATUSES)[number];

/** `required` inserts the human gate: pause at plan, push notify, amber pulse (§3.2). */
export const APPROVALS = ['none', 'required'] as const;
export type Approval = (typeof APPROVALS)[number];

/** Field types the drawer's INPUTS form can render (§2.3, "our additions"). */
export const INPUT_TYPES = ['text', 'url', 'number', 'select', 'textarea', 'date'] as const;
export type InputType = (typeof INPUT_TYPES)[number];

/**
 * What the run leaves behind (ADR-009). Defaults to `md` when absent, because the runner
 * asks every agent to write `output.md` and extracts that file as the artifact.
 *
 * `none` is the deliberate opt-out for an agent whose deliverable is a side effect — it
 * posts to Slack, it does not write a document. It exists so that the validator's
 * "declare a connector that can write a file" rule has a truthful escape hatch: without
 * one, the first side-effect agent gets `workspace` added to silence the error, which is
 * the under-thought widening the rule exists to prevent.
 */
export const PRODUCES = ['md', 'json', 'pdf', 'txt', 'none'] as const;
export type Produces = (typeof PRODUCES)[number];

/** The ladder's three rungs are exactly the three tiers — the active row is `tier`. */
export const LADDER_RUNGS = TIERS;

/* ------------------------------------------------------------------ *
 * Slugs
 * ------------------------------------------------------------------ */

/** kebab-case, no leading/trailing/double dashes. Folder names and cross-references. */
export const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Input keys are the form field names the runner receives — snake_case. */
export const INPUT_KEY_RE = /^[a-z][a-z0-9_]*$/;

/**
 * The one true `name` → folder slug transform. The validator enforces that the folder
 * matches this exactly, because cross-references (`builds_on`, `breaks_into`) resolve
 * by slug and a mismatch is a dangling edge on the map.
 */
export function toSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/* ------------------------------------------------------------------ *
 * Cron (§3.2 — ofelia sync + the clock badge on the node)
 * ------------------------------------------------------------------ */

const CRON_BOUNDS: ReadonlyArray<readonly [number, number]> = [
  [0, 59], // minute
  [0, 23], // hour
  [1, 31], // day of month
  [1, 12], // month
  [0, 7], // day of week (7 == Sunday)
];

/**
 * Five-field cron only. Six-field (seconds) is deliberately rejected: ofelia's Go cron
 * would accept it and the same string would then mean two different things depending on
 * who parsed it.
 */
export function isCronExpression(value: string): boolean {
  const fields = value.trim().split(/\s+/);
  if (fields.length !== 5) return false;

  return fields.every((field, i) => {
    const [min, max] = CRON_BOUNDS[i]!;
    return field.split(',').every((part) => {
      const [range, step] = part.split('/');
      if (step !== undefined && !/^[1-9]\d*$/.test(step)) return false;
      if (range === '*') return true;
      const m = /^(\d+)(?:-(\d+))?$/.exec(range ?? '');
      if (!m) return false;
      const from = Number(m[1]);
      const to = m[2] === undefined ? from : Number(m[2]);
      return from >= min && to <= max && from <= to;
    });
  });
}

/* ------------------------------------------------------------------ *
 * The frontmatter type
 * ------------------------------------------------------------------ */

/** One field of the drawer's INPUTS form, used to build the ▶ Run payload. */
export interface InputField {
  /** snake_case; unique within the agent; the key the runner receives. */
  key: string;
  /** Human label above the field. */
  label: string;
  type: InputType;
  required?: boolean;
  /** Required when `type: select`, meaningless otherwise. */
  options?: string[];
}

/** Post-run delivery (§3.2). At least one target, or omit the field entirely. */
export interface Delivery {
  /** Slack channel or DM, including the leading `#` or `@`. */
  slack?: string;
  email?: string;
}

/**
 * The autonomy maturity model, rendered as three rows in the drawer with `tier`
 * highlighted (§2.3.9). All three rungs are required and they must escalate:
 * human-led is a glance, autonomous is unattended on a schedule.
 */
export interface Ladder {
  'human-led': string;
  assisted: string;
  autonomous: string;
}

/** Part IV frontmatter, field for field. */
export interface AgentFrontmatter {
  /** Node label, drawer title, search index, chart card. */
  name: string;
  /** Drawer body, chart expanded card, search index. 2–3 lines. */
  description: string;
  /** MAP branch, CHART tab, radial force group. Must equal the path segment. */
  department: Department;
  /** MAP sub-cluster caption (§2.2) + drawer breadcrumb. Validated against the registry. */
  cluster: string;
  /** lucide icon name, kebab-case. Must resolve in `lucide-react`. */
  icon: string;
  /** CHART row, drawer eyebrow, the active `ladder` rung. */
  tier: Tier;
  /** CHART column, phase tag + tier dots on the job card. */
  phase: Phase;
  /** Map halo, LIVE counter, audit. Starts `draft`; only real runs promote it. */
  status: Status;
  /** Leaf skill dots on the map; drawer chips, click = fly-to (§2.3.5). */
  breaks_into?: string[];
  /** Prerequisite agents — dashed chip in the drawer and a map edge (§2.3.7). */
  builds_on?: string[];
  /**
   * MCP/tool names. This is a **security boundary**, not documentation: the runner's
   * tool allowlist is exactly this list (§3.2). A tool listed here that the agent does
   * not need widens the blast radius of a bad run.
   */
  wired_into?: string[];
  /**
   * The artifact kind this agent leaves behind. Defaults to `md`. `none` means the
   * deliverable is a side effect and no `output.*` is expected (ADR-009).
   *
   * Paired with `wired_into` by invariant 7: anything other than `none` requires a
   * connector that grants a file-writing tool, or the run produces nothing and says `ok`.
   */
  produces?: Produces;
  /** The WHAT IT REPLACES quote box (§2.3.8). A sentence about the manual work. */
  replaces: string;
  ladder: Ladder;
  /** The THE HUMAN paragraph (§2.3.10). Never "nothing". */
  the_human: string;
  /** Generates the drawer's INPUTS form for ▶ Run. */
  inputs?: InputField[];
  /** Five-field cron. Drives ofelia and the clock badge (§3.2). */
  schedule?: string;
  /** `required` inserts the human gate (§3.2). Defaults to `none` when absent. */
  approval?: Approval;
  deliver?: Delivery;
}

/* ------------------------------------------------------------------ *
 * zod schema
 * ------------------------------------------------------------------ */

const slug = (what: string) => z.string().regex(SLUG_RE, `${what} must be kebab-case`);

export const inputFieldSchema = z
  .object({
    key: z.string().regex(INPUT_KEY_RE, 'input key must be snake_case'),
    label: z.string().min(1),
    type: z.enum(INPUT_TYPES),
    required: z.boolean().optional(),
    options: z.array(z.string().min(1)).optional(),
  })
  .strict()
  .refine((f) => f.type !== 'select' || (f.options?.length ?? 0) > 0, {
    message: 'type: select requires a non-empty options[]',
    path: ['options'],
  });

export const deliverySchema = z
  .object({
    slack: z.string().regex(/^[#@][a-z0-9][a-z0-9._-]*$/, 'slack target must start with # or @'),
    email: z.string().regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'not an email address'),
  })
  .partial()
  .strict()
  .refine((d) => Boolean(d.slack || d.email), 'deliver must name at least one target');

export const ladderSchema = z
  .object({
    'human-led': z.string().min(1),
    assisted: z.string().min(1),
    autonomous: z.string().min(1),
  })
  .strict()
  .refine((l) => new Set([l['human-led'], l.assisted, l.autonomous]).size === 3, {
    message: 'the three ladder rungs must escalate — they cannot be the same sentence',
  });

/**
 * Strict on purpose: an unknown key is almost always a typo (`wired-into`), and a typo
 * that parses silently is a field the drawer renders empty with no error anywhere.
 */
export const agentFrontmatterSchema = z
  .object({
    name: z.string().min(1),
    description: z.string().min(1),
    department: z.enum(DEPARTMENTS),
    cluster: slug('cluster'),
    icon: slug('icon'),
    tier: z.enum(TIERS),
    phase: z.enum(PHASES),
    status: z.enum(STATUSES),
    breaks_into: z.array(slug('breaks_into entry')).optional(),
    builds_on: z.array(slug('builds_on entry')).optional(),
    wired_into: z.array(slug('wired_into entry')).optional(),
    produces: z.enum(PRODUCES).optional(),
    replaces: z.string().min(12, 'replaces must be a sentence about the manual work'),
    ladder: ladderSchema,
    the_human: z
      .string()
      .min(1)
      .refine((v) => !/^\s*(nothing|none|n\/a)\.?\s*$/i.test(v), {
        message: 'the_human is never "nothing" — every agent leaves a human owning strategy or audit',
      }),
    inputs: z.array(inputFieldSchema).optional(),
    schedule: z.string().refine(isCronExpression, 'not a valid 5-field cron expression').optional(),
    approval: z.enum(APPROVALS).optional(),
    deliver: deliverySchema.optional(),
  })
  .strict();

/** Compile-time proof that the interface above and the schema have not drifted apart. */
type SchemaOutput = z.infer<typeof agentFrontmatterSchema>;
const _schemaMatchesInterface: AgentFrontmatter = {} as SchemaOutput;
const _interfaceMatchesSchema: SchemaOutput = {} as AgentFrontmatter;
void _schemaMatchesInterface;
void _interfaceMatchesSchema;

/* ------------------------------------------------------------------ *
 * Cluster registry — agents/_registry/clusters.json (ADR-001)
 * ------------------------------------------------------------------ */

/**
 * A cluster carries a label as well as a slug because §2.2 renders the caption verbatim
 * (`SEQUENCING & SEND`) and no slug transform produces an ampersand.
 */
export interface ClusterDefinition {
  slug: string;
  /** Wide-tracked caps caption floated beside the node group (§2.2). */
  label: string;
}

/**
 * Keyed by department slug, exactly seven keys. The **first three** entries of each list
 * are the department's three sub-labels under the branch caption in the galaxy view
 * (§2.1) — order is therefore meaningful, not alphabetical.
 */
export type ClusterRegistry = Record<Department, ClusterDefinition[]>;

export const clusterDefinitionSchema = z
  .object({ slug: slug('cluster'), label: z.string().min(1) })
  .strict();

export const clusterRegistrySchema = z
  .object(
    Object.fromEntries(
      DEPARTMENTS.map((d) => [d, z.array(clusterDefinitionSchema).min(3)]),
    ) as Record<Department, z.ZodArray<typeof clusterDefinitionSchema>>,
  )
  .strict();

/* ------------------------------------------------------------------ *
 * Connector registry — agents/_registry/connectors.json (invariant 5)
 * ------------------------------------------------------------------ */

/**
 * One row of the connector registry. `wired_into` names this slug; the runner grants
 * exactly `tools` (a trailing `*` is a prefix match). Adding a row widens the blast
 * radius of every agent that lists it — it is not a convenience to unblock one SKILL.md.
 */
export interface ConnectorDefinition {
  label: string;
  tools: string[];
  note?: string;
}

/**
 * Keyed by kebab-case connector slug. Keys starting with `$` in the JSON file are
 * comments and are stripped before parse — JSON has no comment syntax.
 */
export type ConnectorRegistry = Record<string, ConnectorDefinition>;

export const connectorDefinitionSchema = z
  .object({
    label: z.string().min(1),
    tools: z.array(z.string().min(1)).min(1),
    note: z.string().min(1).optional(),
  })
  .strict();

export const connectorRegistrySchema = z.record(
  z.string().regex(SLUG_RE, 'connector name must be kebab-case'),
  connectorDefinitionSchema,
);

/**
 * Parse `agents/_registry/connectors.json`. Strips `$`-prefixed comment keys, then
 * validates the rest. Callers should fail the build on `ok: false` rather than treating
 * an unknown `wired_into` as documentation.
 */
export function parseConnectorRegistryJson(
  value: unknown,
): { ok: true; data: ConnectorRegistry } | { ok: false; errors: string[] } {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return { ok: false, errors: ['connector registry must be an object keyed by slug'] };
  }
  const stripped = Object.fromEntries(
    Object.entries(value as Record<string, unknown>).filter(([k]) => !k.startsWith('$')),
  );
  const result = connectorRegistrySchema.safeParse(stripped);
  if (result.success) return { ok: true, data: result.data };
  return {
    ok: false,
    errors: result.error.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`),
  };
}

/* ------------------------------------------------------------------ *
 * Parse results — what scripts/validate-frontmatter.mjs emits with --json
 * ------------------------------------------------------------------ */

/** One parsed agent file. `slug` is the folder name and the cross-reference key. */
export interface AgentFile {
  slug: string;
  /** Repo-relative, POSIX separators: `agents/sales/account-enrichment/SKILL.md`. */
  path: string;
  department: Department;
  frontmatter: AgentFrontmatter;
  /** Everything after the closing `---` — the system prompt handed to the runner. */
  body: string;
}

export interface ValidationIssue {
  /** Repo-relative path, or `null` for a repo-wide issue (registry, contract drift). */
  path: string | null;
  message: string;
}

/**
 * The machine-readable exit report. A file with errors appears in `excluded` and **not**
 * in `agents` — consumers render the map from `agents` and surface `excluded` as a
 * warning. A half-parsed agent is never rendered.
 */
export interface ValidationReport {
  ok: boolean;
  checked: number;
  agents: Array<Pick<AgentFile, 'slug' | 'path' | 'department'> & {
    cluster: string;
    tier: Tier;
    phase: Phase;
    status: Status;
  }>;
  excluded: Array<{ path: string; slug: string | null; errors: string[] }>;
  warnings: ValidationIssue[];
  /** Repo-wide failures (missing registry, contract drift, duplicate slugs). */
  errors: ValidationIssue[];
}

/**
 * Convenience wrapper. Returns the typed frontmatter or the zod issues — callers should
 * exclude the agent on failure rather than rendering a partial node.
 */
export function parseAgentFrontmatter(
  value: unknown,
): { ok: true; data: AgentFrontmatter } | { ok: false; errors: string[] } {
  const result = agentFrontmatterSchema.safeParse(value);
  if (result.success) return { ok: true, data: result.data };
  return {
    ok: false,
    errors: result.error.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`),
  };
}
