import { access, readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { parseSkillMarkdown } from './parseSkill';
import { toChartAgent, type LoadResult } from './agents';
import type { ChartAgent } from '../types';

/**
 * Server-side projection of `agents/{department}/{slug}/SKILL.md` onto CHART.
 *
 * Same source of truth as every other view (Part IV constraint 4) — this is a read of
 * the library, not a copy. Used when the page renders so `/chart` can show the matrix
 * without waiting on `GET /api/agents` (list form is still requested of runner-engineer).
 *
 * Docker mounts the library at `/agents` (infra compose `x-agents-ro`). `next dev`
 * resolves it relative to the repo. A miss is reported, never guessed.
 */

export type DiskLoadResult = LoadResult & { ok: boolean };

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function resolveAgentsRoot(): Promise<string | undefined> {
  const candidates = [
    '/agents',
    join(process.cwd(), 'agents'),
    join(process.cwd(), '..', 'agents'),
    join(process.cwd(), '..', '..', 'agents'),
  ];
  for (const dir of candidates) {
    if (await exists(dir)) return dir;
  }
  return undefined;
}

export async function loadChartAgentsFromDisk(): Promise<DiskLoadResult> {
  const root = await resolveAgentsRoot();
  if (!root) {
    return { ok: false, agents: [], error: 'agent library unreachable' };
  }

  let departments: string[];
  try {
    const entries = await readdir(root, { withFileTypes: true });
    departments = entries.filter((e) => e.isDirectory() && !e.name.startsWith('_')).map((e) => e.name);
  } catch {
    return { ok: false, agents: [], error: 'agent library unreachable' };
  }

  const agents: ChartAgent[] = [];
  for (const department of departments) {
    let agentDirs: string[] = [];
    try {
      const entries = await readdir(join(root, department), { withFileTypes: true });
      agentDirs = entries.filter((e) => e.isDirectory()).map((e) => e.name);
    } catch {
      continue;
    }
    for (const agent of agentDirs) {
      const slug = `${department}/${agent}`;
      let text: string;
      try {
        text = await readFile(join(root, department, agent, 'SKILL.md'), 'utf8');
      } catch {
        continue;
      }
      const record = parseSkillMarkdown(text, slug);
      if (record) agents.push(toChartAgent(record));
    }
  }

  agents.sort((a, b) => a.slug.localeCompare(b.slug));
  return { ok: true, agents };
}
