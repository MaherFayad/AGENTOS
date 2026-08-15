/**
 * Read `panels/*.json` from disk.
 *
 * Dashboards are data, not code (§2.5). The carousel is a projection of this directory
 * sorted by `order`. A seventh center is a new file; this module never names a panel.
 *
 * Paths tried, in order: `PANELS_DIR`, the compose mount `/panels`, then the monorepo
 * relative locations used by `next dev`. Docker does not copy `panels/` into the image
 * (infra/web.Dockerfile) — the volume is the source of truth.
 *
 * Server-only. Do not import from a client component.
 *
 * Owner: dashboards-engineer · Spec §2.4–2.5
 */

import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { asPanel, sortPanels } from './normalize';
import type { Panel } from '@agnetos/contracts';

export { asPanel, normalizePanelPayload, sortPanels, toSummary } from './normalize';

const DIR_CANDIDATES = (): string[] => {
  const fromEnv = process.env.PANELS_DIR;
  const cwd = process.cwd();
  return [
    ...(fromEnv ? [fromEnv] : []),
    '/panels',
    join(cwd, 'panels'),
    join(cwd, '..', '..', 'panels'),
    join(cwd, '..', 'panels'),
  ];
};

export async function findPanelsDir(): Promise<string | null> {
  for (const dir of DIR_CANDIDATES()) {
    try {
      const entries = await readdir(dir);
      if (entries.some((f) => f.endsWith('.json'))) return dir;
    } catch {
      /* try the next candidate */
    }
  }
  return null;
}

export interface LoadPanelsResult {
  panels: Panel[];
  /** Set when the directory could not be read at all. */
  error?: string;
  dir?: string;
}

export async function loadPanels(): Promise<LoadPanelsResult> {
  const dir = await findPanelsDir();
  if (!dir) {
    return {
      panels: [],
      error:
        'No panels directory found. Add panels/*.json — the carousel is a projection of that folder, not a list in code.',
    };
  }
  let files: string[];
  try {
    files = (await readdir(dir)).filter((f) => f.endsWith('.json') && !f.startsWith('.'));
  } catch {
    return { panels: [], dir, error: `Could not read ${dir}.` };
  }
  const panels: Panel[] = [];
  for (const file of files) {
    try {
      const panel = asPanel(JSON.parse(await readFile(join(dir, file), 'utf8')));
      if (panel) panels.push(panel);
    } catch {
      /* one bad file must not take the carousel down; validate-panels names it in CI */
    }
  }
  return { panels: sortPanels(panels), dir };
}

export async function loadPanel(id: string): Promise<Panel | null> {
  const { panels } = await loadPanels();
  return panels.find((p) => p.id === id) ?? null;
}
