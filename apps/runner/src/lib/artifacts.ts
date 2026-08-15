/**
 * Per-run scratch workspaces and artifact extraction (§3.2: "cwd = per-run scratch
 * workspace", "output artifact (md/pdf/json) saved").
 *
 * The scratch directory is the sandbox: it is created fresh for each run, it is the
 * session's cwd, and it is deleted once the artifact has been copied out. That deletion is
 * the reason `workspace` can be a normal connector — an agent with file tools can only
 * reach a directory that stops existing when the run ends.
 */
import { mkdir, rm, readdir, copyFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import type { ArtifactKind } from '@agnetos/contracts';
import type { RunnerConfig } from './config';
import { ARTIFACT_BASENAME } from './prompt';
import { repoRelative } from './git';

export interface SavedArtifact {
  /** Repo-relative path, for the API. */
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

export async function createScratch(config: RunnerConfig, runId: string): Promise<string> {
  const dir = join(config.scratchRoot, runId);
  await mkdir(dir, { recursive: true });
  return dir;
}

export async function destroyScratch(dir: string): Promise<void> {
  await rm(dir, { recursive: true, force: true });
}

/**
 * Copy the run's deliverable out of the scratch workspace before it is destroyed.
 *
 * Looks for `output.<ext>` first — that is what the system prompt asks for — and falls
 * back to any single file the agent left behind, because an agent that produced work and
 * named the file something else should not have that work thrown away silently. Returns
 * `null` when there is genuinely nothing, which is a legitimate outcome for an agent whose
 * job is to post to Slack rather than produce a document.
 */
export async function extractArtifact(
  config: RunnerConfig,
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

  const destDir = join(config.artifactsRoot, runId);
  await mkdir(destDir, { recursive: true });
  const destination = join(destDir, chosen);
  await copyFile(join(scratchDir, chosen), destination);
  const { size } = await stat(destination);

  return {
    path: repoRelative(config, destination),
    absolutePath: destination,
    kind,
    bytes: size,
  };
}
