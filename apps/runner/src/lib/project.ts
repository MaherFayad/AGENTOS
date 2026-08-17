/**
 * Which project is this request about? (ADR-015, `Plan §9`.)
 *
 * The rule this file implements, and the only one worth remembering:
 *
 *   > **A request names its project in its path, and there is no default.**
 *
 * There is deliberately no `currentProject` here, no cookie, no header and no fallback. If
 * the slug is missing the route does not exist; if it names a project this coordinator does
 * not mount, the answer is a refusal with the mounted slug in the hint. Every alternative —
 * a header, session state, "the only project" — is an ambient default, and an ambient
 * default is the mechanism by which one client's data is served under another client's
 * name (`project-scoping.md` §5.1 Q1/Q2).
 *
 * ## Why the mount is configuration and `ops.project` is a table
 *
 * `ops.project` lives in Postgres, and the runner must keep serving MAP, CHART and the
 * drawer with **no Postgres at all** (`--profile dev`, M0 #3). So the coordinator's own
 * mount — which library this process has on disk — is configuration, resolvable without a
 * database; `ops.project` is the operations plane's row for the same project, keyed by the
 * same slug and the same deterministic id. They cannot drift, because the id is a pure
 * function of the slug and a test asserts the SQL and the TypeScript compute it the same
 * way.
 *
 * Mounting N libraries in one coordinator is the work that comes after M15; until then the
 * honest statement is "one mounted project", made by `project_not_mounted` rather than by a
 * comment.
 */
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { isProjectSlug, type ProjectStatus, type ProjectSummary } from '@agnetos/contracts';
import { ApiError } from './errors';
import type { RunnerConfig } from './config';

/**
 * `md5('agnetos.project:' || slug)` formatted as a UUID.
 *
 * Mirrors `ops.project_id_for(text)` in migration 0005 exactly. Two implementations of one
 * identifier is how a foreign key silently stops matching, so `project-id.test.ts` asserts
 * this against the literal value the SQL produces for the seeded slug.
 *
 * Derived, then stored: `ops.project.id` is authoritative from the moment the row exists,
 * so renaming a slug later keeps the id and every ledger row hanging off it.
 */
export function projectIdForSlug(slug: string): string {
  const hex = createHash('md5').update(`agnetos.project:${slug}`).digest('hex');
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20, 32),
  ].join('-');
}

/**
 * A project this coordinator can actually serve: a slug, a library on disk, a scratch root.
 *
 * **Every read behind a project-scoped route takes this, never `RunnerConfig`.** That is a
 * rule with a mechanism rather than a convention: `RunnerConfig` has no `id`, `slug` or
 * `status`, so a library reader whose parameter is typed `MountedProject` **cannot be handed
 * the coordinator's config at all** — it is a compile error, in the handler that forgot.
 *
 * The rule was earned. Five read handlers (`graph`, `agentsIndex`, `agent`, `panels`,
 * `panel`) resolved `:project` and then read `config.agentsDir` / `config.panelsDir` /
 * `config.graphFile`, while the run path derived all three roots from the project. With one
 * library mounted the two agree — but they agree **by coincidence between two variables, not
 * by derivation from one**, and that is indistinguishable from correct right up to the day a
 * second library is mounted, at which point MAP, CHART and DASHBOARDS would serve the
 * coordinator's library under a project's name with no error anywhere. Found by
 * `rtl-arabic-pdpl-specialist`'s isolation audit, second pass, 2026-08-17.
 */
export interface MountedProject {
  id: string;
  slug: string;
  name: string;
  status: ProjectStatus;
  /** Root of the mounted library — the directory holding `agents/`, `panels/`, `company/`. */
  libraryPath: string;
  /** Per-run scratch workspaces are created under here. */
  workspaceRoot: string;
  /** Resolved `agents/` root for this project's library layer (L1). */
  agentsDir: string;
  /** Resolved `agents/_overrides/` root (L2). */
  overridesDir: string;
  /** `company/COMPANY.md` for this project. No global fallback — see `brain.ts`. */
  companyDir: string;
  companyFile: string;
  companySourcesDir: string;
  /**
   * `panels/` for this project (§2.5). Mounted per project, **never cascaded** and with no
   * coordinator-level fallthrough — `project-scoping.md` §5.1 Q8.
   */
  panelsDir: string;
  /**
   * The stored layout artifact for this project's library (ADR-003).
   *
   * On the artifact's honest limits, because a reader will otherwise assume more than is
   * true: nothing inside `graph.json` names a project, so this field is the *only* thing
   * binding the payload to the project it is served under. A project whose library holds no
   * artifact gets `graph_not_built` — a refusal, which is the answer this coordinator can
   * actually stand behind. Serving a coordinator-wide graph under a project's URL is the one
   * outcome that is not available.
   */
  graphFile: string;
}

/**
 * The one project this process mounts.
 *
 * `AGNETOS_PROJECT_SLUG` names it; `agentos` is the value the seed migration inserts and
 * the value `Plan §24` fixes ("AgentOS becomes `project: AgentOS` in place — nothing moves
 * on disk"). It is a *configuration* default for the mount, not a default for a *request*:
 * a request that names no project still gets `project_scope_missing`.
 */
export function mountedProject(config: RunnerConfig): MountedProject {
  const slug = config.projectSlug;
  return {
    id: projectIdForSlug(slug),
    slug,
    name: config.projectName,
    status: 'active',
    libraryPath: config.repoRoot,
    workspaceRoot: config.scratchRoot,
    agentsDir: config.agentsDir,
    overridesDir: join(config.agentsDir, '_overrides'),
    companyDir: config.companyDir,
    companyFile: config.companyFile,
    companySourcesDir: config.companySourcesDir,
    panelsDir: config.panelsDir,
    graphFile: config.graphFile,
  };
}

/**
 * Resolve the `:project` path segment.
 *
 * Three refusals, deliberately distinct, because collapsing them is how "we cannot serve
 * this project" gets read as "this project has nothing in it":
 *
 *   `project_scope_missing` (400) — the segment is absent or empty.
 *   `project_not_found`     (404) — not a slug, or not a slug this coordinator knows.
 *   `project_not_mounted`   (503) — a real project, but its library is not on this host.
 */
export function resolveProject(config: RunnerConfig, raw: unknown): MountedProject {
  const slug = typeof raw === 'string' ? decodeURIComponent(raw).trim() : '';

  if (slug === '') {
    throw scopeMissing(config);
  }

  if (!isProjectSlug(slug)) {
    throw new ApiError('project_not_found', `"${slug}" is not a project id.`, {
      hint: `Project ids are lowercase and hyphenated — this coordinator serves "${config.projectSlug}". Check the project switcher in the shell header.`,
      retryable: false,
    });
  }

  const mounted = mountedProject(config);
  if (slug !== mounted.slug) {
    // Not `project_not_found`: the project may exist perfectly well in `ops.project` and
    // simply live on another execution host (`host_affinity`, Plan §9). Saying "not found"
    // would send someone looking for a typo in a name that is correct.
    throw new ApiError('project_not_mounted', `This coordinator does not mount the project "${slug}".`, {
      hint: `It serves "${mounted.slug}" and nothing else right now. If "${slug}" lives on another machine, open it from the coordinator running there — routing a run to another host is not built yet.`,
      retryable: false,
    });
  }

  if (mounted.status !== 'active') {
    throw new ApiError('project_not_active', `The project "${slug}" is ${mounted.status}.`, {
      hint: 'A paused project keeps all of its history and its whole library; it just does not start runs. Set it back to active in the project switcher.',
      retryable: false,
    });
  }

  return mounted;
}

/** The refusal a pre-project URL gets. Written for a human reading it on a phone. */
export function scopeMissing(config: RunnerConfig, scopedPath?: string): ApiError {
  const example = scopedPath
    ? scopedPath.replace(':project', config.projectSlug)
    : `/api/p/${config.projectSlug}/…`;
  return new ApiError(
    'project_scope_missing',
    'This request did not say which project it is about.',
    {
      hint: `Every route that reads or writes a project's data carries the project in its path. Use ${example}. There is deliberately no default project — a default is how one client's data gets served under another client's name.`,
      retryable: false,
    },
  );
}

/**
 * Is migration 0005's row-level security actually in force on this connection?
 *
 * **Asked, never assumed.** RLS is bypassed entirely by a superuser or a `BYPASSRLS` role,
 * and compose's default Postgres user is a superuser — so on the stack as it ships today
 * every policy in that migration is inert. Reporting `bypassed` from a probe is a task
 * somebody can close; writing `false` from a comment is a claim that ages into a lie.
 *
 * `'unknown'` is its own answer and is not `'bypassed'`: with no ledger we have not learned
 * that isolation is off, we have failed to ask. Collapsing those two is the same disease as
 * a `0` where the truth is *unknown* (BOARD rule 9).
 */
export type ScopeEnforcement = 'enforced' | 'bypassed' | 'unknown';

export async function probeScopeEnforcement(
  db: { query: <R = Record<string, unknown>>(sql: string, params?: readonly unknown[]) => Promise<{ rows: R[] }> } | null,
): Promise<ScopeEnforcement> {
  if (!db) return 'unknown';
  try {
    const { rows } = await db.query<{ enforced: boolean | null }>(
      'SELECT ops.project_scope_enforced() AS enforced',
    );
    const enforced = rows[0]?.enforced;
    if (enforced === true) return 'enforced';
    if (enforced === false) return 'bypassed';
    return 'unknown';
  } catch {
    // The function is missing (migration 0005 not applied) or the query failed. Either way
    // we do not know, and saying so is the only honest answer available.
    return 'unknown';
  }
}

/** `GET /api/projects` row for a mounted project. Declared-but-unread fields say so. */
export function toProjectSummary(project: MountedProject): ProjectSummary {
  return {
    id: project.id,
    slug: project.slug,
    name: project.name,
    status: project.status,
    libraryPath: project.libraryPath,
    // A git remote is an egress event of the same class as a `deliver:` target leaving the
    // tailnet. Migration 0005 carries a CHECK that keeps the column NULL until that ADR
    // lands, so this is not a placeholder — it is the only value the database will hold.
    libraryRemote: null,
    hostAffinity: [],
    hostAffinityEnforced: false,
    budgetMonthlyUsd: null,
    budgetEnforced: false,
    defaultAccountId: null,
  };
}
