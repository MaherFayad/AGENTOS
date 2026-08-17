/**
 * The cascade at **dispatch** — ADR-014 pass 3, the only one of its three passes that is a
 * boundary.
 *
 * `agent-library-curator` owns resolution semantics (`contracts/agent-cascade.md`,
 * ADR-014). This file owns the mount — which roots exist, in what order they are read, for
 * which project — and the one enforcement point ADR-014 puts in the runner's court:
 *
 *   > A lower layer may **subtract** from `wired_into` and may **tighten** `approval`. It
 *   > may never add or loosen. Widening requires a new slug, hence a new `agent_ref` with
 *   > zero history.
 *
 * Nothing here re-defines a rule from that contract. If ADR-014 changes, this follows it.
 *
 * ## Why the runner and not CI
 *
 * If a project layer could add to `wired_into`, then a `git push` to a project library
 * would be a capability grant — on a node that keeps the global agent's name, its icon and
 * the copper halo it earned. That is BOARD rule 4 defeated with no code bug at all. The
 * validator catches it in seconds and is the right feedback loop, but **CI is not a wall**:
 * it runs on a repo, and the thing that runs is a resolved agent on a host.
 *
 * The lesson this file is written under is one this repo paid for: `workspace` confinement
 * was a code comment claiming a boundary, and only a test that asserted on the *filesystem*
 * proved a run could overwrite the repo-root `.env`. So the test for this file
 * (`cascade-ceiling.test.ts`) asserts on **the allowlist the session actually received**,
 * not on the validator's opinion of a file.
 *
 * ## Fail closed, and know the difference between two kinds of missing
 *
 * If the introducing layer cannot be **read**, the ceiling is unknown and the run is
 * refused with `cascade_unresolved`. If a global library is simply **not configured**, that
 * is not an error — the cascade has two real levels until a global library exists (BOARD,
 * M15 scope), and the project layer is then the introducing layer. Those two are different
 * facts and collapsing them would either break every dev machine or silently trust a local
 * file's tool list. Same disease as `unknown` vs `zero`, one plane up.
 */
import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { agentRef as makeAgentRef, sourceRef, type CascadeLayer } from '@agnetos/contracts';
import { ApiError } from './errors';
import { isAgentSlug, type RunnerConfig } from './config';
import type { MountedProject } from './project';
import { parseFrontmatter } from './frontmatter';
import { recordFromSource, type AgentRecord } from './agents';

/** The roots read for one project, least- to most-specific (ADR-014 §1). */
export interface CascadeRoots {
  /**
   * `<global>/agents` — `null` when no global library is configured, which is the state
   * today and is **not** an error.
   */
  global: string | null;
  /** `<repo>/agents` — the project library. */
  project: string;
  /** `<repo>/agents/_overrides` — keeps the department segment (ADR-014 §1.3). */
  override: string;
}

export function cascadeRoots(config: RunnerConfig, project: MountedProject): CascadeRoots {
  return {
    global: config.globalLibraryDir,
    project: project.agentsDir,
    override: project.overridesDir,
  };
}

/** One layer's file for a `(department, slug)`, once we know it is there. */
export interface LayerFile {
  layer: CascadeLayer;
  /** Absolute path. */
  absolutePath: string;
  source: string;
  /** sha256 of the bytes as read here — what actually ran. */
  digest: string;
}

/**
 * The capability ceiling: `wired_into` and `approval` as the **introducing** layer declares
 * them. The introducing layer is the *least*-specific layer that defines this
 * `(department, slug)` for this project (ADR-014 §3, Class C).
 */
export interface Ceiling {
  layer: CascadeLayer;
  path: string;
  connectors: readonly string[];
  approvalRequired: boolean;
}

/** What `resolveThroughCascade` hands back: the file that won, and the ceiling it must respect. */
export interface CascadeResolution {
  winner: LayerFile;
  ceiling: Ceiling;
  /**
   * The winning file's own Class C declaration, read **by the same function** that read the
   * ceiling.
   *
   * This is not a convenience. If the caller derived this side itself — from
   * `resolveAllowlist`, say — the two sides of the comparison would be parsed by two code
   * paths, and the day they disagreed about what `wired_into: hubspot` (a bare string, not
   * a list) or `Shell` (capitalised) means, the check would pass a widening it could not
   * see. One parser, two readings, is the defect class this whole milestone keeps meeting.
   *
   * Note it carries the *raw* connector names, not resolved tools: a name the registry does
   * not know is still a widening if the ceiling does not contain it, and it must be refused
   * as one rather than dropped as unknown.
   */
  resolved: Ceiling;
  /** `{layer}:{path}@sha256:…` for the ledger. Recorded on the run, never on the agent. */
  sourceRef: string;
  /** Parsed frontmatter of the winning file, so the caller does not parse it a second time. */
  winnerData: Record<string, unknown>;
}

const ORDER: readonly CascadeLayer[] = ['global', 'project', 'override'];

function rootFor(roots: CascadeRoots, layer: CascadeLayer): string | null {
  if (layer === 'global') return roots.global;
  if (layer === 'project') return roots.project;
  return roots.override;
}

function isMissing(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { code?: string }).code === 'ENOENT';
}

/**
 * Read one layer's file, distinguishing "not there" from "there and unreadable".
 *
 * `null` means the layer does not define this agent. A throw means we could not find out,
 * and finding out is the whole job — a permission error on the global mount must never be
 * read as "the global library does not define this agent", because that reading silently
 * promotes the local file to introducing layer and hands it its own ceiling.
 */
async function readLayer(
  roots: CascadeRoots,
  layer: CascadeLayer,
  department: string,
  slug: string,
): Promise<LayerFile | null> {
  const root = rootFor(roots, layer);
  if (root === null) return null;

  const absolutePath = join(root, department, slug, 'SKILL.md');
  try {
    const source = await readFile(absolutePath, 'utf8');
    return {
      layer,
      absolutePath,
      source,
      digest: createHash('sha256').update(source).digest('hex'),
    };
  } catch (error) {
    if (isMissing(error)) return null;
    throw new ApiError(
      'cascade_unresolved',
      `The ${layer} library could not be read, so this agent's capability ceiling is unknown.`,
      {
        hint: `Nothing was run. ${absolutePath} exists but could not be opened (${
          error instanceof Error ? error.message : String(error)
        }). The runner refuses rather than trusting the copy it can read — a lower layer may only ever narrow what a higher one allows, and it cannot check that against a library it cannot open.`,
        retryable: true,
        cause: error,
      },
    );
  }
}

function connectorsOf(data: Record<string, unknown>): string[] {
  const raw = data.wired_into;
  const list = Array.isArray(raw) ? raw : typeof raw === 'string' && raw.trim() !== '' ? [raw] : [];
  const out: string[] = [];
  for (const entry of list) {
    const name = String(entry).trim().toLowerCase();
    if (name !== '' && !out.includes(name)) out.push(name);
  }
  return out;
}

function approvalOf(data: Record<string, unknown>): boolean {
  return String(data.approval ?? '').trim().toLowerCase() === 'required';
}

function frontmatterOf(file: LayerFile): Record<string, unknown> {
  try {
    return parseFrontmatter(file.source).data;
  } catch (error) {
    throw new ApiError(
      'cascade_unresolved',
      `The ${file.layer} layer's copy of this agent has frontmatter the runner cannot read, so its capability ceiling is unknown.`,
      {
        hint: `Nothing was run. Fix the frontmatter in ${file.absolutePath}. A file that fails to parse is excluded and does **not** fall through to the layer below — falling through would silently run a different agent, with the wider tool list of the layer underneath (ADR-014 §1.2).`,
        retryable: false,
        cause: error,
      },
    );
  }
}

/**
 * Walk the three roots for one `(department, slug)`.
 *
 * Returns the most-specific file that defines it (the resolved agent, whole-file, no field
 * merge — ADR-014 §1.1) together with the ceiling declared by the least-specific one.
 */
export async function resolveThroughCascade(
  roots: CascadeRoots,
  department: string,
  slug: string,
  repoRoot: string,
): Promise<CascadeResolution> {
  const found: LayerFile[] = [];
  for (const layer of ORDER) {
    const file = await readLayer(roots, layer, department, slug);
    if (file) found.push(file);
  }

  const introducing = found[0];
  const winner = found[found.length - 1];
  if (!introducing || !winner) {
    throw new ApiError('agent_not_found', `No agent at "${department}/${slug}" in this project.`, {
      hint: `Nothing exists at agents/${department}/${slug}/SKILL.md in this project's library${
        roots.global ? ', in its overrides, or in the global library' : ' or in its overrides'
      }. Check the id on the map — it is the folder path, not the display name.`,
      retryable: false,
    });
  }

  const relative = (absolute: string): string =>
    absolute.startsWith(repoRoot) ? absolute.slice(repoRoot.length + 1).split('\\').join('/') : absolute;

  const classCOf = (file: LayerFile): Ceiling => {
    const data = frontmatterOf(file);
    return {
      layer: file.layer,
      path: relative(file.absolutePath),
      connectors: connectorsOf(data),
      approvalRequired: approvalOf(data),
    };
  };

  // Read in this order deliberately: if the *introducing* layer's frontmatter is
  // unreadable we must refuse before we have any opinion about the winner, because the
  // alternative is a run that proceeds on a ceiling nobody derived.
  const ceiling = classCOf(introducing);
  const resolved = introducing === winner ? ceiling : classCOf(winner);

  return {
    winner,
    ceiling,
    resolved,
    sourceRef: sourceRef(winner.layer, relative(winner.absolutePath), winner.digest),
    winnerData: frontmatterOf(winner),
  };
}

/**
 * THE ENFORCEMENT POINT — capability narrows downward, checked at dispatch.
 *
 * Refuses; it does **not** silently intersect. Intersecting would run an agent whose tool
 * list nobody wrote and nobody read in the drawer, which is the same failure the allowlist
 * exists to prevent, arrived at from the other direction.
 *
 * A resolved file that *is* the introducing layer passes trivially — which is every agent
 * in this repo today, so adopting this costs zero file changes and would cost a great deal
 * the day after the first project override is written.
 */
export function assertNarrowsDownward(
  ceiling: Ceiling,
  resolved: { layer: CascadeLayer; connectors: readonly string[]; approvalRequired: boolean; path: string },
): void {
  if (resolved.layer === ceiling.layer) return;

  const added = resolved.connectors.filter((name) => !ceiling.connectors.includes(name));
  if (added.length > 0) {
    throw new ApiError(
      'capability_widened',
      `${resolved.path} grants ${added.join(', ')}, which the ${ceiling.layer} layer that introduced this agent does not.`,
      {
        hint: `Nothing was run. A project layer may take capability away from an agent, never add it — otherwise editing a library repo would be a way to grant tools to a node that keeps the name, the icon and the run history the original earned. To give this agent ${added.join(
          ', ',
        )}, copy it under a new slug: that makes it a new agent, with its own permissions and zero runs. The ceiling is set by ${ceiling.path}.`,
        retryable: false,
      },
    );
  }

  if (ceiling.approvalRequired && !resolved.approvalRequired) {
    throw new ApiError(
      'capability_widened',
      `${resolved.path} sets approval: none over a ${ceiling.layer} layer that requires approval.`,
      {
        hint: `Nothing was run. approval may be tightened by a lower layer (none → required) and never loosened, for the same reason wired_into may only be narrowed. ${ceiling.path} is what sets the ceiling.`,
        retryable: false,
      },
    );
  }
}

/** What dispatch needs: the agent that will run, and the provenance of the file it came from. */
export interface DispatchAgent {
  record: AgentRecord;
  /** `{project}/{department}/{slug}` — the foreign key of every operations row (ADR-014 §2). */
  agentRef: string;
  /** `{layer}:{path}@sha256:…` — recorded on the run, never on the agent. */
  sourceRef: string;
  /** The layer whose file actually ran, for the provenance badge (`⌂` · `▣`). */
  layer: CascadeLayer;
  /** The introducing layer's Class C declaration, for the drawer and for the error hint. */
  ceiling: Ceiling;
}

/**
 * **The only way to obtain a resolved agent — for a run, and now for a read.**
 *
 * Resolution and enforcement are one call on purpose. If they were two, a future caller
 * could resolve without asserting and would get a working run — the check would then be
 * something a reviewer has to notice, which is the definition of not-a-mechanism. Here the
 * `AgentRecord` does not exist until `assertNarrowsDownward` has returned.
 *
 * The record is built from **the same bytes** the ceiling was derived from. Nothing is
 * re-read between the check and the run.
 *
 * ## The name says dispatch; `GET /api/agents/:slug` calls it too, and that is the fix
 *
 * Until 2026-08-17 this had exactly one caller, and the read path used `loadAgent` — a
 * single-layer read of `<repo>/agents/{slug}/SKILL.md`. The consequence was not cosmetic:
 * **an override could win a run while MAP, CHART, the drawer and the validator all kept
 * showing the global file.** What you saw was not what ran, which is BOARD rule 4 defeated
 * without a single line of wrong code, and `Plan §21.9`'s bug class with no error message.
 *
 * So the read path resolves through the same function, and the property is now structural:
 * the drawer renders the agent that would run, or the same refusal the run would give. A
 * read caller is **not** a second door — the door is the agent-session factory, which
 * `one-door.test.ts` asserts has exactly one call site, and that call site is not here.
 * Resolving cannot spend anything. The exhaustive caller list in that test is what keeps a
 * third caller a deliberate act.
 */
export async function resolveForDispatch(
  config: RunnerConfig,
  project: MountedProject,
  slug: string,
): Promise<DispatchAgent> {
  if (!isAgentSlug(slug)) {
    throw new ApiError('bad_request', `"${slug}" is not a valid agent id.`, {
      hint: 'Use department/agent-slug, exactly as it appears in the repo — for example sales/account-enrichment.',
      retryable: false,
    });
  }
  const [department, name] = slug.split('/') as [string, string];

  const resolution = await resolveThroughCascade(
    cascadeRoots(config, project),
    department,
    name,
    config.repoRoot,
  );

  assertNarrowsDownward(resolution.ceiling, resolution.resolved);

  return {
    record: recordFromSource(config, slug, resolution.winner.source, resolution.winner.absolutePath),
    agentRef: makeAgentRef(project.slug, slug),
    sourceRef: resolution.sourceRef,
    layer: resolution.winner.layer,
    ceiling: resolution.ceiling,
  };
}

/**
 * Every `(department, slug)` one root defines, as `department/slug` strings.
 *
 * `_`-prefixed directories are skipped at the department level — `_overrides` and
 * `_registry` are the two reserved names under `agents/` (ADR-014 §1.3) and neither is a
 * department. The override root is `agents/_overrides` itself, so *its* children are
 * departments and the same skip is a no-op there.
 *
 * A root that cannot be read contributes nothing rather than throwing: an absent global
 * library is the normal state (BOARD, M15 scope), and the *dangerous* kind of unreadable —
 * a layer that exists but will not open for an agent someone asked for — is caught per
 * agent by `readLayer`, which refuses the run rather than silently promoting a lower layer.
 * Those are two different facts and only the second may fail closed.
 */
async function keysUnder(root: string | null): Promise<string[]> {
  if (root === null) return [];

  let departments: string[];
  try {
    const entries = await readdir(root, { withFileTypes: true });
    departments = entries.filter((e) => e.isDirectory() && !e.name.startsWith('_')).map((e) => e.name);
  } catch {
    return [];
  }

  const keys: string[] = [];
  for (const department of departments) {
    try {
      const entries = await readdir(join(root, department), { withFileTypes: true });
      for (const entry of entries) if (entry.isDirectory()) keys.push(`${department}/${entry.name}`);
    } catch {
      // A department directory that vanished between the two reads contributes nothing.
    }
  }
  return keys;
}

/**
 * The **resolved set** for one project — what MAP, CHART and DASHBOARDS project
 * (ADR-014 §1).
 *
 * The union of `(department, slug)` across all three mounted roots, each resolved through
 * the one cascade, each ceiling-checked. `onSkip` receives everything excluded and why:
 * ADR-014 §1.2 requires a broken file to be **excluded with a named reason and never to
 * fall through**, and `AgentsIndex.skipped[]` is where that reason reaches a person.
 *
 * Two consequences worth naming, because both were previously invisible:
 *
 * 1. **`agents/_overrides/**` is now enumerable.** Every other enumerator in this repo skips
 *    `_`-prefixed folders (`agent-cascade.md` §11, gap 1), so an override file would have
 *    won a run and appeared on no surface at all. It does not exist yet in any project —
 *    this closes the hole before the first one is written, which is the only cheap time.
 * 2. **A widened override is a `skipped[]` row, not a tile.** It refuses at dispatch, so
 *    rendering it as a normal agent would put a tool list on screen that cannot run.
 */
export async function listResolvedAgents(
  config: RunnerConfig,
  project: MountedProject,
  onSkip?: (slug: string, reason: string) => void,
): Promise<DispatchAgent[]> {
  const roots = cascadeRoots(config, project);
  const keys = new Set<string>([
    ...(await keysUnder(roots.global)),
    ...(await keysUnder(roots.project)),
    ...(await keysUnder(roots.override)),
  ]);

  const resolved: DispatchAgent[] = [];
  for (const slug of [...keys].sort((a, b) => a.localeCompare(b))) {
    if (!isAgentSlug(slug)) {
      onSkip?.(slug, 'slug is not kebab-case');
      continue;
    }
    try {
      resolved.push(await resolveForDispatch(config, project, slug));
    } catch (err) {
      onSkip?.(slug, err instanceof ApiError ? err.message : 'failed to resolve');
    }
  }
  return resolved;
}
