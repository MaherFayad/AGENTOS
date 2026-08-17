/**
 * `GET /api/panels` and `GET /api/panels/:id` (§2.5).
 *
 * "Dashboards are data, not code" (BOARD constraint 3) — `panels/*.json` is
 * `dashboards-engineer`'s schema and this route serves it verbatim. The runner parses the
 * JSON and nothing more: it does not validate against the panel schema, does not fill in
 * defaults, and does not reorder widgets.
 *
 * That restraint is the point. If the runner started normalising panel files, the panel
 * contract would have two implementations — the validator `dashboards-engineer` owns and
 * whatever this file happens to do — and a panel would render differently depending on
 * which one you asked. Validation lives in `npm run validate:panels`, at commit time,
 * where a broken panel is a build failure with a filename rather than a silent shrug at
 * runtime.
 *
 * ## Panels are mounted per project, and there is no fallthrough
 *
 * `project-scoping.md` §5.1 Q8: panels are **not** cascaded. Both functions read
 * `MountedProject.panelsDir`, and this module cannot name `RunnerConfig` at all, so a
 * project route physically cannot serve the coordinator's dashboards under a project's name.
 *
 * A project with no `panels/` of its own shows **nothing** — an empty carousel, not the
 * coordinator's six Command Centers. That is Q8's deferred question, answered in the
 * contract; the reason it is not a fallthrough is that a panel is a *query shape* naming
 * agents and metrics from the library it was written against, so inheriting one renders
 * another project's dashboard filled with this project's numbers, and there is no state in
 * which that is distinguishable from a dashboard someone meant to build.
 */
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { ApiError } from './errors';
import type { MountedProject } from './project';

export interface PanelSummary {
  id: string;
  /** The panel document, exactly as stored. */
  panel: unknown;
}

/** `panels/<id>.json` ids are a single kebab segment — no paths, no traversal. */
const PANEL_ID_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export async function listPanels(project: MountedProject): Promise<PanelSummary[]> {
  let files: string[];
  try {
    const entries = await readdir(project.panelsDir, { withFileTypes: true });
    files = entries.filter((e) => e.isFile() && e.name.endsWith('.json')).map((e) => e.name);
  } catch {
    // No panels directory is an empty dashboard set, not a server error — and not the
    // coordinator's set either. An honest empty carousel, per the header note.
    return [];
  }

  const panels: PanelSummary[] = [];
  for (const file of files.sort()) {
    const id = file.replace(/\.json$/, '');
    if (!PANEL_ID_RE.test(id)) continue;
    try {
      panels.push({ id, panel: JSON.parse(await readFile(join(project.panelsDir, file), 'utf8')) });
    } catch {
      // One malformed file must not take the carousel down. It is omitted here and named
      // loudly by `npm run validate:panels`, which is the tool that can actually fix it.
    }
  }
  return panels;
}

export async function readPanel(project: MountedProject, id: string): Promise<unknown> {
  if (!PANEL_ID_RE.test(id)) {
    throw new ApiError('panel_not_found', `"${id}" is not a panel id.`, {
      hint: 'Panel ids are the filename without .json — for example `revenue-command`.',
      retryable: false,
    });
  }
  try {
    return JSON.parse(await readFile(join(project.panelsDir, `${id}.json`), 'utf8'));
  } catch {
    throw new ApiError('panel_not_found', `No panel called "${id}" in "${project.slug}".`, {
      hint: `Dashboards are files: add panels/${id}.json to that project's library and it appears in the carousel. No registration step — and no inheriting one from another project.`,
      retryable: false,
    });
  }
}
