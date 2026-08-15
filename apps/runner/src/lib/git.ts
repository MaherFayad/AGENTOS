/**
 * Git writes — the schedule commit (§3.2) and the read side of "git history is brain
 * versioning" (§3.3).
 *
 * Two constraints shape everything here:
 *
 * - **Writes never leave `agents/**`** (ADR-002). Enforced by `assertInsideAgents` before
 *   any path reaches git, and again by committing an explicit pathspec so a dirty working
 *   tree elsewhere cannot ride along in the runner's commit.
 * - **The runner commits as itself.** A schedule change made by a machine should read as
 *   one in `git log`. The author is fixed, not inherited from whatever identity happens
 *   to be configured in the container.
 */
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { relative } from 'node:path';
import { ApiError } from './errors';
import { assertInsideAgents, assertInsideCompany, type RunnerConfig } from './config';

const exec = promisify(execFile);

const RUNNER_IDENTITY = [
  '-c',
  `user.name=${process.env.RUNNER_GIT_NAME ?? 'AgnetOS runner'}`,
  '-c',
  `user.email=${process.env.RUNNER_GIT_EMAIL ?? 'runner@agnetos.local'}`,
];

export async function git(cwd: string, args: string[]): Promise<string> {
  try {
    const { stdout } = await exec('git', args, { cwd, windowsHide: true, maxBuffer: 8 * 1024 * 1024 });
    return stdout.trim();
  } catch (err) {
    const stderr = (err as { stderr?: string }).stderr?.trim();
    throw new ApiError('git_failed', `git ${args[0]} failed${stderr ? `: ${stderr}` : '.'}`, {
      hint: 'The change was not committed, so nothing is half-applied. Check that the repo is a git checkout the runner can write to.',
      cause: err,
    });
  }
}

/** Repo-relative, forward-slashed — the form git wants and the API returns. */
export function repoRelative(config: RunnerConfig, absolutePath: string): string {
  return relative(config.repoRoot, absolutePath).split('\\').join('/');
}

/**
 * Commit a single file under `agents/`. Returns the new commit SHA.
 *
 * The pathspec is passed to `git commit` as well as `git add`, so this cannot sweep up
 * unrelated staged work — a runner commit contains exactly the file the runner changed
 * and nothing a passing prompt injection managed to stage.
 */
export async function commitAgentFile(
  config: RunnerConfig,
  absolutePath: string,
  message: string,
): Promise<string> {
  assertInsideAgents(config, absolutePath);
  return commitPath(config, absolutePath, message);
}

/**
 * Commit a single file under `company/` — the Second Brain write-back (§3.3, ADR-007).
 *
 * Separate from `commitAgentFile` on purpose. One function per write boundary means the
 * boundary check cannot be skipped by passing a different path to a shared helper, and
 * `grep commitCompanyFile` answers "what in this service can write the brain?" in full.
 */
export async function commitCompanyFile(
  config: RunnerConfig,
  absolutePath: string,
  message: string,
): Promise<string> {
  assertInsideCompany(config, absolutePath);
  return commitPath(config, absolutePath, message);
}

/** Private. Callers reach this only through a boundary-checked wrapper above. */
async function commitPath(
  config: RunnerConfig,
  absolutePath: string,
  message: string,
): Promise<string> {
  const pathspec = repoRelative(config, absolutePath);

  await git(config.repoRoot, ['add', '--', pathspec]);

  const staged = await git(config.repoRoot, ['diff', '--cached', '--name-only', '--', pathspec]);
  if (staged === '') {
    // Nothing changed — the requested state is already the committed state. Return the
    // current HEAD rather than inventing an empty commit; the response stays truthful and
    // the git log stays readable.
    return git(config.repoRoot, ['rev-parse', 'HEAD']);
  }

  await git(config.repoRoot, [...RUNNER_IDENTITY, 'commit', '-m', message, '--', pathspec]);
  return git(config.repoRoot, ['rev-parse', 'HEAD']);
}

/** ISO 8601 of the last commit touching a path, or `null` if it has never been committed. */
export async function lastCommitIso(config: RunnerConfig, pathspec: string): Promise<string | null> {
  try {
    const out = await git(config.repoRoot, ['log', '-1', '--format=%cI', '--', pathspec]);
    return out === '' ? null : out;
  } catch {
    // No git, no commits, or a path git has never seen. Not an error: a brand-new
    // COMPANY.md with no history is a legitimate state, and reporting `null` says so.
    return null;
  }
}
