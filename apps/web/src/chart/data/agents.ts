import type { ChartAgent } from '../types';

/**
 * CHART reads the SAME frontmatter every other view reads (§2.6 closing line, Part IV
 * standing constraint 4). This module is a *projection*: it maps parsed frontmatter onto
 * the handful of fields the matrix draws and keeps nothing.
 *
 * Source: `GET /api/agents` — the list projection of `agents/**` frontmatter. The single
 * `GET /api/agents/:slug` in contracts/api-contracts.md serves the drawer; the list form
 * is requested from `runner-engineer` in
 * comms/inbox/runner-engineer/*-chart-agents-list-endpoint.md. Until it lands, CHART shows
 * its honest empty state rather than a fabricated grid (Part VII.3).
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

export async function loadChartAgents(
  fetchImpl: typeof fetch = fetch,
  url = '/api/agents',
): Promise<LoadResult> {
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
