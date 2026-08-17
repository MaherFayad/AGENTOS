/**
 * The project axis — the code half of `comms/contracts/project-scoping.md` (ADR-015).
 *
 * Owner: `runner-engineer`, in trust for `platform-projects-engineer`.
 * Source: `AGENTOS-V2-PLAN.md` Plan §9 · §10 · §11 — **a plan that amends the spec of
 * record, not spec** (ADR-013). Cite `Plan §9`, never `§9`.
 *
 * One idea runs through this whole file: **a request names its project in its path, and
 * there is no default.** A header is invisible in a log and in a bug report; a server-side
 * "current project" is an ambient default, and an ambient default is the mechanism by which
 * one project's data gets served under another project's name. A path segment is greppable,
 * cacheable, and impossible to forget — the route simply does not exist without it.
 */

/** Kebab-case, one segment. Mirrors `ops.project.slug_is_a_slug`. */
export const PROJECT_SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * Slugs a project may not take, because a URL would then be ambiguous:
 * `p` is the project namespace, `all` is the deliberate cross-project one, `api` is the
 * mount point. Mirrored by `ops.project.slug_is_not_reserved`.
 */
export const RESERVED_PROJECT_SLUGS = ['p', 'all', 'api'] as const;

export function isProjectSlug(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    PROJECT_SLUG_RE.test(value) &&
    !(RESERVED_PROJECT_SLUGS as readonly string[]).includes(value)
  );
}

export type ProjectStatus = 'active' | 'paused' | 'archived';

/**
 * `GET /api/projects` — what the switcher lists (§23.12 P1).
 *
 * Every field that is **declared but read by nothing** carries a sibling boolean saying so.
 * A cap rendered next to no enforcement is a UI telling a lie it was handed; the flag is
 * what stops that being an accident rather than a decision.
 *
 * **Audited 2026-08-17 alongside `/api/all/approvals`, and it is clean — today, for a
 * reason that expires.** This is `scope: 'coordinator'`, but it is the other route that
 * returns one row per client, so the same question was asked of it field by field.
 * `toProjectSummary` hardcodes `budgetMonthlyUsd`, `defaultAccountId`, `hostAffinity` and
 * `libraryRemote` to their empty values — nothing is read from the database row — and
 * `apps/web/src/components/shell/useProjects.ts` says in a comment that it does not read
 * them. So no client data crosses here.
 *
 * The hazard is the day ADR-015 Q6 lands and `budgetMonthlyUsd` becomes real: this route
 * then returns **every client's monthly budget to any caller**, which is a commercial figure
 * about one client reaching the context of another — the same defect `/api/all/approvals`
 * had, arriving through a field that already exists rather than a route someone adds. It is
 * written here rather than fixed because there is nothing to fix yet and a filter over four
 * nulls would be untestable. **Whoever makes these fields real narrows this row in the same
 * commit**, or says why not.
 */
export interface ProjectSummary {
  id: string;
  slug: string;
  name: string;
  status: ProjectStatus;
  /** Absolute path of the library this project mounts. */
  libraryPath: string;
  /** Always `null` in M15 — a git remote is an egress decision (ADR-015 Q5), and the column carries a CHECK that keeps it null until that ADR lands. */
  libraryRemote: null;
  /** Declared, read by nothing. See `hostAffinityEnforced`. */
  hostAffinity: string[];
  hostAffinityEnforced: false;
  /** Declared, not enforced in M15 (ADR-015 Q6). See `budgetEnforced`. */
  budgetMonthlyUsd: number | null;
  budgetEnforced: false;
  defaultAccountId: string | null;
}

export interface ProjectsResponse {
  projects: ProjectSummary[];
  /**
   * Which project the coordinator itself mounts. In M15 exactly one library is mounted,
   * so `projects[]` may list rows the runner cannot serve — say which one it can rather
   * than letting a switcher discover it by 404.
   */
  mounted: string;
  /**
   * `false` ⇒ this connection bypasses row-level security (superuser or `BYPASSRLS`), so
   * the database-level project isolation in migration 0005 is **inert**. Reported rather
   * than assumed: an isolation guarantee nobody can see the status of is a claim.
   */
  scopeEnforced: boolean | null;
}

/**
 * Which plane a route belongs to. Kept as data so a test can assert that every route
 * touching project data carries the segment, and that the cross-project set stays small
 * enough to read.
 */
export type RouteScope =
  /** `/api/p/:project/…` — reads or writes one project's data. */
  | 'project'
  /** `/api/…` — describes the coordinator itself, not a project's data. */
  | 'coordinator'
  /** `/api/all/…` — deliberately spans projects. Every row it returns names its project. */
  | 'cross-project';

export const PROJECT_ROUTE_PREFIX = '/api/p/:project';
export const CROSS_PROJECT_ROUTE_PREFIX = '/api/all';

/**
 * Fill `:project` in a route template. Clients build URLs with this rather than by string
 * concatenation, so there is exactly one place that knows the shape of the segment.
 */
export function projectPath(template: string, slug: string): string {
  if (!isProjectSlug(slug)) {
    throw new Error(
      `"${slug}" is not a project slug. Expected kebab-case, and not one of ${RESERVED_PROJECT_SLUGS.join(', ')}.`,
    );
  }
  return template.replace(':project', slug);
}

/**
 * The identity of an agent under the cascade: `{project}/{department}/{slug}` (ADR-014 §2).
 *
 * This — not `department/slug` — is the foreign key of every operations row. The
 * consequence, which is the whole point of the decision and must not be softened: run
 * history, ledger rows and liveness **never follow a fork or a promotion**. Two projects
 * with the same `(department, slug)` are two agents, two histories, two halos.
 */
export function agentRef(project: string, agentSlug: string): string {
  return `${project}/${agentSlug}`;
}

/** The three cascade layers, least- to most-specific (ADR-014 §1). */
export type CascadeLayer = 'global' | 'project' | 'override';

/**
 * `{layer}:{path}@{digest}` — which file won the cascade, at what content. Recorded on
 * every **run**, never on the agent.
 *
 * The digest is `sha256` of the resolved file's bytes as read at dispatch. It answers
 * "what actually ran". It is deliberately **not** the same number as ADR-014 §4.2's
 * `forked_from.digest`, which is a digest of *normalized* frontmatter+body and answers
 * "has the parent changed?". Two digests because two questions; naming them apart here is
 * cheaper than discovering they were assumed equal.
 */
export function sourceRef(layer: CascadeLayer, path: string, sha256: string): string {
  return `${layer}:${path}@sha256:${sha256}`;
}

/** How the paying account for a run was chosen (ADR-015 Q20). */
export type AccountSource =
  /** `ops.project.default_account_id`. The common case needs no decision. */
  | 'project-default'
  /** An explicit per-run override. */
  | 'run-override'
  /**
   * We do not know who paid. Not "nobody" and not "the default" — cost-by-account surfaces
   * must show this as its own bucket rather than dropping the rows.
   */
  | 'unattributed';
