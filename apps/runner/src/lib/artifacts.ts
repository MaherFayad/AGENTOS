/**
 * Per-run scratch workspaces and artifact extraction (§3.2: "cwd = per-run scratch
 * workspace", "output artifact (md/pdf/json) saved").
 *
 * The scratch directory is the sandbox: it is created fresh for each run, it is the
 * session's cwd, and it is deleted once the artifact has been copied out. That deletion is
 * the reason `workspace` can be a normal connector — an agent with file tools can only
 * reach a directory that stops existing when the run ends.
 *
 * ## Both roots are the project's, and this module cannot reach the coordinator's
 *
 * Every function here takes `MountedProject` and **`RunnerConfig` is not imported at all**,
 * which is the same arrangement `graph.ts` and `panels.ts` carry and for the same reason:
 * a caller cannot pass the coordinator's roots, because the type it would have to pass has
 * no `artifactsDir` and no `slug`. It is a compile error in the handler that forgot rather
 * than a rule someone has to keep.
 *
 * The defect it closes, found by `rtl-arabic-pdpl-specialist`'s isolation sign-off (second
 * pass, *Deliberately not done*): artefacts were written to `artifactsRoot/<runId>/` with
 * **no project segment on disk**. Two clients' durable output shared one directory tree,
 * distinguished only by a run id that nothing on the filesystem relates back to a project.
 * That is the ledger's missing `project_id` one layer down — and worse in one specific way,
 * because a filesystem has no constraint that can refuse the write. `assertAttributed`
 * could throw; `copyFile` cannot. So the only mechanism available is that the destination
 * is **derived** from the project rather than remembered by the caller, which is what this
 * file now is. PDPL rule 4 (*client data does not cross clients*) and rule 6 (*anything
 * that must persist is written deliberately to a named location*), Part VII.4.
 *
 * ## Migration: there is nothing to move, and a found directory is refused
 *
 * Zero runs have ever executed (`RUNNER_ANTHROPIC_API_KEY` is unset), so there are no
 * artefacts anywhere and this change moves no bytes. That is the honest statement and it
 * expires the moment a run happens, so the *rule* is written down rather than the count:
 *
 *   **A directory in the old layout is refused, never adopted, and never deleted.**
 *
 * Adopting one — treating `artifactsRoot/<runId>/` as belonging to whichever project the
 * coordinator happens to mount — would attribute one client's output to another client on
 * the strength of a coincidence, which is precisely what the ledger's `run_unattributed`
 * refusal exists to prevent. Ignoring it silently is the same act with the evidence hidden.
 * Deleting it would destroy a client's bytes to tidy a layout, which is not a trade the
 * runner gets to make. So: the writer only ever writes under a project, and
 * `assertArtifactInProject` refuses to *serve* anything that is not under the serving
 * project's own directory, naming the path so a human can move it deliberately.
 */
import { mkdir, rm, readdir, copyFile, stat } from 'node:fs/promises';
import { isAbsolute, join, relative, resolve } from 'node:path';
import type { ArtifactKind } from '@agnetos/contracts';
import { ApiError } from './errors';
import type { MountedProject } from './project';
import { ARTIFACT_BASENAME } from './prompt';

export interface SavedArtifact {
  /** Library-relative path, for the API. Carries the project segment. */
  path: string;
  absolutePath: string;
  kind: ArtifactKind;
  bytes: number;
}

/** Extension → artifact kind, in the order we prefer to find them. */
const KINDS: ReadonlyArray<[string, ArtifactKind]> = [
  ['.md', 'md'],
  ['.json', 'json'],
  ['.pdf', 'pdf'],
  ['.txt', 'txt'],
];

/** Forward-slashed and relative to the project's own library — the form the API returns. */
function libraryRelative(project: MountedProject, absolutePath: string): string {
  return relative(project.libraryPath, absolutePath).split('\\').join('/');
}

function isInside(root: string, target: string): boolean {
  const rel = relative(resolve(root), resolve(target));
  return rel !== '' && !rel.startsWith('..') && !isAbsolute(rel);
}

export async function createScratch(project: MountedProject, runId: string): Promise<string> {
  const dir = join(project.workspaceRoot, runId);
  await mkdir(dir, { recursive: true });
  return dir;
}

export async function destroyScratch(dir: string): Promise<void> {
  await rm(dir, { recursive: true, force: true });
}

/**
 * Refuse to serve bytes that are not this project's.
 *
 * The download route already refuses a run belonging to another project (`run_not_found`,
 * deliberately opaque). This is the *second* question, and it is the one the run store
 * could not answer before: the in-memory store is a cache that dies with the process, so
 * "the artefact of a run in project A is project A's" was a property of a cache rather than
 * of the store. With the project on disk it is a property of the path, and this is where
 * that gets asserted.
 *
 * Reachable in exactly two states, both worth a loud refusal rather than a stream: a
 * pre-M15 `artifactsRoot/<runId>/` directory attached to a run somehow, and a future code
 * path that writes an artefact somewhere else. Neither should be adopted, and neither
 * should be silently 404'd into "this run produced nothing".
 */
export function assertArtifactInProject(project: MountedProject, absolutePath: string): void {
  if (isInside(project.artifactsDir, absolutePath)) return;
  throw new ApiError(
    'artifact_unattributed',
    `This run's artifact is not stored inside "${project.slug}".`,
    {
      hint:
        `Nothing was deleted. The file is at ${absolutePath}, and this project's artefacts live under ` +
        `${project.artifactsDir}. A directory in the pre-M15 layout (artifacts/<runId>/, with no project ` +
        'segment) is refused rather than adopted, because adopting it would file one client\'s output under ' +
        'whichever project happens to be mounted. Move it into the right project\'s directory by hand if you ' +
        'know whose it is — and if you do not know, that is the answer this refusal is reporting.',
      retryable: false,
    },
  );
}

/**
 * Copy the run's deliverable out of the scratch workspace before it is destroyed.
 *
 * Looks for `output.<ext>` first — that is what the system prompt asks for — and falls
 * back to any single file the agent left behind, because an agent that produced work and
 * named the file something else should not have that work thrown away silently. Returns
 * `null` when there is genuinely nothing, which is a legitimate outcome for an agent whose
 * job is to post to Slack rather than produce a document.
 *
 * The destination is `<project.artifactsDir>/<runId>/`. There is no argument to this
 * function that could send it anywhere else.
 */
export async function extractArtifact(
  project: MountedProject,
  runId: string,
  scratchDir: string,
): Promise<SavedArtifact | null> {
  let entries: string[];
  try {
    const dirents = await readdir(scratchDir, { withFileTypes: true });
    entries = dirents.filter((e) => e.isFile()).map((e) => e.name);
  } catch {
    return null;
  }
  if (entries.length === 0) return null;

  let chosen: string | undefined;
  let kind: ArtifactKind = 'txt';

  for (const [ext, k] of KINDS) {
    const named = `${ARTIFACT_BASENAME}${ext}`;
    if (entries.includes(named)) {
      chosen = named;
      kind = k;
      break;
    }
  }

  if (!chosen) {
    const candidates = entries.filter((name) => KINDS.some(([ext]) => name.endsWith(ext)));
    if (candidates.length !== 1) return null;
    chosen = candidates[0] as string;
    kind = (KINDS.find(([ext]) => (chosen as string).endsWith(ext))?.[1] ?? 'txt') as ArtifactKind;
  }

  const destDir = join(project.artifactsDir, runId);
  await mkdir(destDir, { recursive: true });
  const destination = join(destDir, chosen);
  await copyFile(join(scratchDir, chosen), destination);
  const { size } = await stat(destination);

  return {
    path: libraryRelative(project, destination),
    absolutePath: destination,
    kind,
    bytes: size,
  };
}
