import { RUNNER_ROUTES } from '@agnetos/contracts';
import { NO_PROJECT_SENTENCE, projectApiUrl } from '@/components/shell/useSearchIndex';
import type { ChartAgent } from '../types';

/**
 * CHART reads the SAME frontmatter every other view reads (§2.6 closing line, Part IV
 * standing constraint 4). This module is a *projection*: it maps parsed frontmatter onto
 * the handful of fields the matrix draws and keeps nothing.
 *
 * Source: `RUNNER_ROUTES.agentsIndex` — the list projection of `agents/**` frontmatter.
 * `RUNNER_ROUTES.agent` (the wildcard) serves the drawer. Until the list endpoint has data,
 * CHART shows its honest empty state rather than a fabricated grid (Part VII.3).
 *
 * ---
 *
 * **The URL comes out of `RUNNER_ROUTES`, and that is the repair rather than a tidy-up.**
 *
 * M15 moved every project-shaped route under `/api/p/:project` (ADR-015). This file held
 * `'/api/agents'` as a default parameter, so nothing broke at build time and nothing failed
 * legibly at run time: the route it named is still mounted and now answers **400
 * `project_scope_missing`**, which arrives here as `!res.ok` and is reported as *"agent
 * library unavailable"* — the library, blamed for the address. A literal is what made that
 * possible, so there is no longer one to type; the next time this path moves, this file
 * moves with it or fails to compile.
 *
 * `projectApiUrl` is `shell-navigation-engineer`'s helper and is imported rather than
 * re-typed: `map/data/socket.ts` keeps a local `scopedPath` only because it also has to
 * build a `ws://` origin, and a fourth private copy of five lines is how the rule that
 * `null` means *do not ask* acquires a fourth reading. `drawer/run/transport.ts` imports the
 * same one.
 *
 * **`project === null` returns the no-project sentence and sends nothing.** Not the unscoped
 * path: it is still mounted (`LEGACY_UNSCOPED_PATHS`) precisely so a stale client gets a
 * named refusal, and calling it anyway converts the runner's deliberate 400 into a shrug on
 * a view whose entire value is that its numbers are real.
 */

/** The frontmatter fields CHART consumes, exactly as contracts/frontmatter-schema.md names them. */
interface AgentFrontmatterSubset {
  name: string;
  description: string;
  department: string;
  icon: string;
  tier: string;
  phase: string;
  breaks_into?: string[];
}

export interface AgentRecord {
  /** `{department}/{agent-slug}` — invariant 1 of the frontmatter contract. */
  slug: string;
  frontmatter: AgentFrontmatterSubset;
}

/** Frontmatter → chart projection. One direction only; nothing writes back. */
export function toChartAgent(record: AgentRecord): ChartAgent {
  const fm = record.frontmatter;
  return {
    slug: record.slug,
    name: fm.name,
    description: fm.description,
    department: fm.department as ChartAgent['department'],
    icon: fm.icon,
    tier: fm.tier as ChartAgent['tier'],
    phase: fm.phase as ChartAgent['phase'],
    skills: fm.breaks_into ?? [],
  };
}

export interface LoadResult {
  agents: readonly ChartAgent[];
  /** Set when the library could not be read at all — the UI must say so, not guess. */
  error?: string;
}

/**
 * `GET /api/p/:project/agents`, or `null` when there is no project to scope to.
 *
 * Exported so the test can assert on the string that actually reaches the network, rather
 * than on the intent of the function that builds it — the assertion that would have caught
 * the migration this file missed.
 */
export function agentsIndexUrl(project: string | null): string | null {
  return projectApiUrl(RUNNER_ROUTES.agentsIndex.path, project);
}

/**
 * `project` is the first parameter and is **not optional**, so a caller cannot forget it
 * and silently get the pre-project shape. The compiler is the only thing that reliably
 * catches this class, which is the whole lesson of the route migration.
 */
export async function loadChartAgents(
  project: string | null,
  fetchImpl: typeof fetch = fetch,
): Promise<LoadResult> {
  const url = agentsIndexUrl(project);
  if (url === null) return { agents: [], error: NO_PROJECT_SENTENCE };
  try {
    const res = await fetchImpl(url, { headers: { accept: 'application/json' } });
    if (!res.ok) return { agents: [], error: `agent library unavailable (${res.status})` };
    const body = (await res.json()) as { agents?: AgentRecord[] };
    return { agents: (body.agents ?? []).map(toChartAgent) };
  } catch {
    return { agents: [], error: 'agent library unreachable' };
  }
}

export const agentsInDepartment = (
  agents: readonly ChartAgent[],
  department: string,
): readonly ChartAgent[] => agents.filter((a) => a.department === department);
