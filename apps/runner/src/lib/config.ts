/**
 * Runner configuration and the repo paths it is allowed to touch.
 *
 * Two rules live here and are enforced everywhere else by importing from this file:
 *
 * 1. **Secrets are read, never echoed.** `ANTHROPIC_API_KEY` is loaded into memory and
 *    reported only as a boolean (`configured`). It is never logged, never traced, never
 *    written to `comms/`, and never returned by a route (Part V billing).
 * 2. **Writes are confined to two roots, one code path each.** `agents/**` for schedule
 *    commits (ADR-002) and `company/**` for the Second Brain write-back (ADR-007). There
 *    is no general "write a file" helper and deliberately no third root, so a
 *    prompt-injected agent that talks the runner into a write cannot reach `apps/`,
 *    `infra/` or `comms/`.
 */
import { resolve, join, relative, isAbsolute, sep } from 'node:path';
import { existsSync } from 'node:fs';
import { ApiError } from './errors';

/**
 * Repo root. In compose this is the bind-mounted project root; in dev it is found by
 * walking up from the runner package until a marker directory appears. Overridable with
 * `AGNETOS_REPO_ROOT`, which is what the tests use.
 */
function looksLikeRepoRoot(dir: string): boolean {
  return existsSync(join(dir, 'skilltree-clone-spec.md')) || existsSync(join(dir, 'agents'));
}

function findRepoRoot(): string {
  const fromEnv = process.env.AGNETOS_REPO_ROOT;
  if (fromEnv) return resolve(fromEnv);

  // Compose mounts the project at `/repo` (writable git path) and the library again at
  // `/agents:ro`. Git writes and COMPANY.md write-back must go through `/repo` — the
  // read-only mounts would 403 a schedule commit and a brain update alike.
  if (looksLikeRepoRoot('/repo')) return '/repo';

  let dir = resolve(process.cwd());
  for (let i = 0; i < 6; i += 1) {
    if (looksLikeRepoRoot(dir)) return dir;
    const parent = resolve(dir, '..');
    if (parent === dir) break;
    dir = parent;
  }
  return resolve(process.cwd());
}

export interface RunnerConfig {
  repoRoot: string;
  agentsDir: string;
  companyDir: string;
  companyFile: string;
  companySourcesDir: string;
  panelsDir: string;
  /** Where the stored layout artifact lives (ADR-003). Served, never regenerated on read. */
  graphFile: string;
  /** Per-run scratch workspaces are created under here and destroyed after extraction. */
  scratchRoot: string;
  /** Saved artifacts (md/pdf/json) outlive the scratch workspace. */
  artifactsRoot: string;
  /** True when the runner's own API key is present. Never exposes the key itself. */
  configured: boolean;
  /** Hard monthly cap in USD, or `null` when uncapped (Part V). */
  monthlyCapUsd: number | null;
  /** Max concurrent sessions; everything else queues and shows in `queueDepth`. */
  maxConcurrentRuns: number;
  /** Model the runner's headless sessions use. */
  model: string;
  /** ofelia's sync endpoint/command target; `null` disables the sync step. */
  ofeliaSyncUrl: string | null;
  langfuse: { baseUrl: string | null; publicKey: string | null; secretKey: string | null };
  slackWebhookUrl: string | null;
}

/**
 * `.env.example` ships every secret as a `…-REPLACE-ME` placeholder, and a placeholder is
 * a non-empty string — so `Boolean(process.env.ANTHROPIC_API_KEY)` answered **true** on a
 * stack where no key had ever been supplied. `GET /api/status` then reported
 * `runnerConfigured: true`, and `POST /api/run` sailed past the `runner_not_configured`
 * gate to die inside the SDK with a raw upstream auth error instead of the contracted 503
 * and its hint. Same disease as the latched ledger: a broken state that reads as a healthy
 * one.
 *
 * The test is deliberately narrow — the two placeholder words this repo actually ships —
 * and says nothing about a real key's shape. Guessing at key formats is how a valid key
 * gets refused six months from now.
 */
export function isPlaceholderSecret(value: string | undefined): boolean {
  if (value === undefined) return true;
  const trimmed = value.trim();
  if (trimmed === '') return true;
  return /replace[-_ ]?me|change[-_ ]?me/i.test(trimmed);
}

function numberFromEnv(name: string, fallback: number | null): number | null {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === '') return fallback;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`${name} must be a non-negative number, got "${raw}"`);
  }
  return parsed;
}

export function loadConfig(): RunnerConfig {
  const repoRoot = findRepoRoot();
  return {
    repoRoot,
    agentsDir: join(repoRoot, 'agents'),
    companyDir: join(repoRoot, 'company'),
    companyFile: join(repoRoot, 'company', 'COMPANY.md'),
    companySourcesDir: join(repoRoot, 'company', 'sources'),
    panelsDir: join(repoRoot, 'panels'),
    graphFile: process.env.RUNNER_GRAPH_FILE
      ? resolve(process.env.RUNNER_GRAPH_FILE)
      : join(repoRoot, 'apps', 'web', 'public', 'graph.json'),
    scratchRoot: process.env.RUNNER_SCRATCH_ROOT
      ? resolve(process.env.RUNNER_SCRATCH_ROOT)
      : existsSync('/workspaces')
        ? '/workspaces'
        : join(repoRoot, '.runner', 'scratch'),
    artifactsRoot: process.env.RUNNER_ARTIFACTS_ROOT
      ? resolve(process.env.RUNNER_ARTIFACTS_ROOT)
      : existsSync('/workspaces')
        ? join('/workspaces', 'artifacts')
        : join(repoRoot, '.runner', 'artifacts'),
    // Presence only. The value stays in process.env and is read at spawn time by the
    // Agent SDK; nothing in this service copies it into a variable that could be logged.
    // A `REPLACE-ME` placeholder is not presence — see `isPlaceholderSecret`.
    configured: !isPlaceholderSecret(process.env.ANTHROPIC_API_KEY),
    monthlyCapUsd: numberFromEnv('RUNNER_MONTHLY_CAP_USD', null),
    maxConcurrentRuns: numberFromEnv('RUNNER_MAX_CONCURRENT_RUNS', 3) ?? 3,
    model: process.env.RUNNER_MODEL ?? 'claude-opus-5',
    ofeliaSyncUrl: process.env.OFELIA_SYNC_URL ?? null,
    langfuse: {
      // Compose names this LANGFUSE_HOST; the observability module reads LANGFUSE_BASE_URL.
      // Accept both so a run still traces when only infra's name is set.
      baseUrl: process.env.LANGFUSE_BASE_URL ?? process.env.LANGFUSE_HOST ?? null,
      publicKey: process.env.LANGFUSE_PUBLIC_KEY ?? null,
      secretKey: process.env.LANGFUSE_SECRET_KEY ?? null,
    },
    slackWebhookUrl: process.env.SLACK_WEBHOOK_URL ?? null,
  };
}

/** Agent slugs are `department/agent-slug`: two kebab segments, nothing else. */
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*\/[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function isAgentSlug(value: string): boolean {
  return SLUG_RE.test(value);
}

/**
 * Resolve `department/agent-slug` to its SKILL.md, refusing anything that escapes
 * `agents/`.
 *
 * The regex alone would be enough today, but the containment check is kept as a second,
 * independent gate: this path is reachable from a request body, and a single regex is a
 * single point of failure for "can a caller read /etc/passwd".
 */
export function agentSkillPath(config: RunnerConfig, slug: string): string {
  if (!isAgentSlug(slug)) {
    throw new ApiError('bad_request', `"${slug}" is not a valid agent id.`, {
      hint: 'Use department/agent-slug, exactly as it appears in the repo — for example sales/account-enrichment.',
    });
  }
  const path = join(config.agentsDir, slug, 'SKILL.md');
  assertInsideAgents(config, path);
  return path;
}

/**
 * The write boundary (ADR-002): "The runner's git writes (§3.2 schedule commits) touch
 * `agents/` only — a path check in the runner enforces that, so a prompt-injected agent
 * cannot commit to `apps/`."
 *
 * This is that path check. It compares resolved paths, so `..` traversal and symlink-ish
 * trickery in the input both fail closed rather than being normalised into something
 * plausible.
 */
export function assertInsideAgents(config: RunnerConfig, targetPath: string): void {
  assertInsideRoot(config, config.agentsDir, targetPath, 'agents/');
}

/**
 * The second write boundary (ADR-007): the Second Brain write-back.
 *
 * §3.3 requires COMPANY.md to be committed — "git history is brain versioning" — and
 * COMPANY.md is not under `agents/`. Rather than widen the ADR-002 rule to "the repo", a
 * second, equally narrow root exists, reachable from exactly one code path
 * (`writeBackBrain`, gated on the interview agent's slug). Two named doors beat one wide
 * one: each is greppable, and neither is a general-purpose write.
 */
export function assertInsideCompany(config: RunnerConfig, targetPath: string): void {
  assertInsideRoot(config, config.companyDir, targetPath, 'company/');
}

function assertInsideRoot(
  config: RunnerConfig,
  root: string,
  targetPath: string,
  label: string,
): void {
  const abs = isAbsolute(targetPath) ? resolve(targetPath) : resolve(config.repoRoot, targetPath);
  const rel = relative(resolve(root), abs);
  if (rel === '' || rel.startsWith('..') || isAbsolute(rel) || rel.split(sep).includes('..')) {
    throw new ApiError('git_write_refused', `The runner may only write inside ${label} here.`, {
      hint: 'This is a safety limit, not a bug: the runner writes agent frontmatter and the company brain, and nothing else. Nothing was changed.',
    });
  }
}
