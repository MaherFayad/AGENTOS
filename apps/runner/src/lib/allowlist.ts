/**
 * The tool allowlist — the security boundary of the whole system (§3.2).
 *
 * Spec, verbatim: "tools from frontmatter allowlist". BOARD standing constraint 4: "The
 * runner's tool allowlist is exactly `wired_into`. Never a superset."
 *
 * The model here is deny-by-default with an explicit intersection:
 *
 *     permitted = registry(wired_into)          // and nothing else, ever
 *
 * There is no base set of "harmless" tools bolted on underneath. That is the whole point:
 * a base set is a superset, and a superset means the answer to "what could this agent
 * touch?" stops being the `WIRED INTO` list a human read in the drawer before pressing
 * Run. The moment those two answers differ, the drawer is lying and the allowlist is
 * decoration.
 */
import { isAbsolute, relative, resolve, sep } from 'node:path';
import { ApiError } from './errors';

export interface Connector {
  /** Human label — what the drawer's `WIRED INTO` line shows. */
  label: string;
  /**
   * Concrete tool names this connector grants. A trailing `*` is a prefix match, which is
   * how MCP servers expose a family of tools under one connector name.
   */
  tools: readonly string[];
  /**
   * **Can this runner see, and therefore bound, where this connector writes?** Required, and
   * required for a reason worth the sentence: M17 gives repo-touching runs a git worktree, and
   * *"a worktree is not a jail"* — `cwd` decides where a relative path resolves and nothing
   * more. `isPathInsideRunRoots` bounds a tool whose arguments **declare** their paths; it
   * cannot bound a shell command string, and it cannot bound an MCP server interpreting its
   * own arguments in another process.
   *
   *   `gated`   — every write is a declared path argument, checked per call.
   *   `none`    — writes nothing into this host's filesystem.
   *   `ungated` — writes somewhere this process cannot check. A run holding one of these is
   *               **refused a worktree** (`assertWorktreeConfinable`), which is a decision not
   *               to hand it a repository rather than a claim to have jailed it.
   *
   * **This field is required so that the check is not an include-list.** *An include-list is a
   * decision to be blind to everything unnamed* (BRIEF) — `CHROME_DIRS` was one, and it was
   * blind to every directory that did not exist when it was written. A required field cannot
   * be blind to the next connector: the next connector does not compile without answering.
   */
  writes: 'gated' | 'none' | 'ungated';
  /** Why it exists, so the next person deciding whether to add one has a precedent. */
  note?: string;
}

/**
 * The connector registry (frontmatter-schema.md invariant 5: "`wired_into` names must
 * exist in the runner's connector registry, or the run is rejected").
 *
 * Adding a row here is a deliberate act that widens what agents can do. It is not a
 * convenience step to unblock an agent — an unrecognised name is answered with
 * `unknown_connector` and a blocker message to this agent, never a silent grant.
 */
export const CONNECTOR_REGISTRY: Readonly<Record<string, Connector>> = {
  // --- research / retrieval -------------------------------------------------
  exa: { label: 'Exa', tools: ['mcp__exa__*'], writes: 'none', note: 'Neural search MCP.' },
  firecrawl: { label: 'Firecrawl', tools: ['mcp__firecrawl__*'], writes: 'none', note: 'Page scraping MCP.' },
  'web-search': { label: 'Web search', tools: ['WebSearch'], writes: 'none' },
  'web-fetch': { label: 'Web fetch', tools: ['WebFetch'], writes: 'none' },

  // --- the scratch workspace ------------------------------------------------
  // Scoped to the per-run scratch cwd by the session's working directory, which is
  // destroyed after artifact extraction. An agent that needs to write its output file
  // declares `workspace`; one that only reasons does not, and then genuinely cannot write.
  workspace: {
    label: 'Scratch workspace',
    tools: ['Read', 'Write', 'Edit', 'Glob', 'Grep'],
    // Enforced by `isPathInsideRunRoots` below, not by the cwd. The cwd only decides where
    // a *relative* path resolves; these tools accept absolute paths, so before that gate
    // existed this note was a claim the code did not make.
    writes: 'gated',
    note: 'Read/write inside this run\'s roots only (§3.2), enforced per path argument.',
  },
  shell: {
    label: 'Shell',
    tools: ['Bash'],
    // **The honest entry.** `Bash` takes `{command}`; `pathArgumentsOf` finds no path in a
    // command string, so the gate returns `true` and one `cd ..` leaves any directory we set.
    // No agent in the library declares this connector today, and a run that does is refused a
    // worktree rather than given one we cannot bound (`worktree.ts`).
    writes: 'ungated',
    note: 'Deliberately separate from `workspace`. Most agents must not have it.',
  },

  // --- delivery / data ------------------------------------------------------
  // `writes: 'none'` here means **nothing in this host's filesystem**, which is the question
  // the worktree refusal asks. Each of these writes somewhere else — a channel, a mailbox, a
  // CRM, a table — and those boundaries are governed elsewhere (`approval: required`,
  // `writeOutput`'s single table, ADR-038 for anything leaving the tailnet).
  slack: { label: 'Slack', tools: ['mcp__slack__*'], writes: 'none' },
  gmail: { label: 'Gmail', tools: ['mcp__gmail__*'], writes: 'none', note: 'Draft and send; send is gated by approval: required.' },
  hubspot: { label: 'HubSpot', tools: ['mcp__hubspot__*'], writes: 'none', note: 'CRM system of record.' },
  postgres: { label: 'Postgres', tools: ['mcp__postgres__*'], writes: 'none', note: 'Agent output rows (§2.5).' },
  langfuse: { label: 'Langfuse', tools: ['mcp__langfuse__*'], writes: 'none', note: 'Read-only, for the auditor.' },

  // --- version control ------------------------------------------------------
  // Grants the *tool*, not the write boundary. Which paths a commit may touch is decided
  // by `assertInsideAgents` / `assertInsideCompany` in config.ts, on the runner's side of
  // the wire, where a prompt cannot argue with it (ADR-002, ADR-007).
  git: {
    label: 'Git',
    tools: ['mcp__git__*'],
    // `ungated`, and the distinction is worth stating because the note below is easy to
    // misread. The **runner's own** git writes are bounded by `assertInsideAgents` /
    // `assertInsideCompany`. This connector grants an agent a git MCP *server*, which runs in
    // another process and is bounded by nothing this file can check — so a run holding it is
    // refused a worktree rather than handed one it could commit outside of.
    writes: 'ungated',
    note: 'Repo history. The runner\'s own write paths are bounded by the runner; this server\'s are not.',
  },

  // --- the second brain (§3.3) ---------------------------------------------
  // The company-interview agent is the one thing that may write COMPANY.md. It is a
  // connector rather than an implicit capability so it shows up in `WIRED INTO` like
  // everything else — the interview agent's power should be visible on the map.
  'company-brain': {
    label: 'Company brain',
    tools: ['mcp__company__*'],
    // Writes `company/` by design (ADR-007) — outside any run's roots, on purpose. That is a
    // deliberate second door, not an escape; it is `ungated` here because the worktree
    // question is *"can this runner bound where it writes"*, and for this one the answer is no
    // and the intent is that it writes elsewhere.
    writes: 'ungated',
    note: 'Read/write company/COMPANY.md + sources. Interview agent only (§3.3).',
  },
};

export interface ResolvedAllowlist {
  /** Connector names from frontmatter, in declaration order. */
  connectors: string[];
  /** Concrete tool names/patterns. Exactly the union of the resolved connectors. */
  tools: string[];
  /** `wired_into` entries with no registry row. Non-empty ⇒ the run is refused. */
  unknown: string[];
}

/**
 * Map `wired_into` to concrete tools. Pure, so the same function answers both
 * "what will this run be permitted to do" (the SSE `start` event, the drawer) and
 * "is this call permitted" (the gate below) — one source of truth for one question.
 */
export function resolveAllowlist(wiredInto: readonly string[] | undefined): ResolvedAllowlist {
  const connectors: string[] = [];
  const tools: string[] = [];
  const unknown: string[] = [];

  for (const rawName of wiredInto ?? []) {
    const name = String(rawName).trim().toLowerCase();
    if (name === '') continue;
    const connector = CONNECTOR_REGISTRY[name];
    if (!connector) {
      if (!unknown.includes(name)) unknown.push(name);
      continue;
    }
    if (!connectors.includes(name)) connectors.push(name);
    for (const tool of connector.tools) if (!tools.includes(tool)) tools.push(tool);
  }

  return { connectors, tools, unknown };
}

/** Exact match, or prefix match for a registry pattern ending in `*`. */
function matches(pattern: string, toolName: string): boolean {
  if (pattern.endsWith('*')) return toolName.startsWith(pattern.slice(0, -1));
  return pattern === toolName;
}

/**
 * THE ENFORCEMENT POINT.
 *
 * Every tool call in a run passes through here before it executes, including calls the
 * model invents mid-run that were never in the plan a human approved.
 *
 * Why this exists even though the resolved list is also handed to the Agent SDK as
 * `allowedTools`: in the SDK, `allowedTools` means *auto-approve without prompting* — it
 * does not restrict Claude to only those tools. A tool outside it falls through to the
 * permission flow rather than being denied. So the SDK's own list is configured as one of
 * three layers, not as the boundary:
 *
 *   1. `allowedTools`      — the resolved list, so permitted calls run without a prompt.
 *   2. `permissionMode`    — `dontAsk`, so a call outside that list is denied rather than
 *                            waiting for an interactive human who, in a headless run
 *                            fired by cron at 06:00 on a Monday, does not exist.
 *   3. `canUseTool`        — this function, as the final, explicit, testable gate.
 *
 * Layer 3 is the one under test (`allowlist.test.ts`: a tool absent from `wired_into` is
 * rejected even when requested mid-run). Layers 1 and 2 are configuration and could be
 * changed by a future SDK default; this is code we own, in a repo we control, with a test
 * that fails loudly if someone widens it.
 */
export function isToolAllowed(allowlist: ResolvedAllowlist, toolName: string): boolean {
  if (typeof toolName !== 'string' || toolName === '') return false;
  return allowlist.tools.some((pattern) => matches(pattern, toolName));
}

/** Throwing form, for call sites that should abort the run rather than branch. */
export function assertToolAllowed(allowlist: ResolvedAllowlist, toolName: string): void {
  if (isToolAllowed(allowlist, toolName)) return;
  throw new ApiError(
    'tool_not_allowed',
    `This agent asked to use "${toolName}", which is not in its wired_into list.`,
    {
      hint: `The agent is only allowed: ${allowlist.tools.join(', ') || '(no tools)'}. If it genuinely needs "${toolName}", add the connector to the agent's wired_into in its SKILL.md and commit that — the run's permissions come from the file, not from the run.`,
      retryable: false,
    },
  );
}

/**
 * THE SECOND ENFORCEMENT POINT — the *argument*, not just the name.
 *
 * `isToolAllowed` gates which tool may run. It says nothing about what that tool may
 * touch. For `workspace` (`Read`, `Write`, `Edit`, `Glob`, `Grep`) that gap was the whole
 * boundary: this file claimed the connector was "scoped to the per-run scratch cwd", and
 * `agent-library-curator` widened twelve agents to `workspace` on the strength of that
 * sentence. **cwd is where relative paths resolve; it is not a wall.** The Agent SDK's file
 * tools take absolute paths, so `Read("/repo/.env")` was one token away from working.
 *
 * This is the same shape as `assertInsideAgents` / `assertInsideCompany` in `config.ts`,
 * applied to the run's scratch directory — resolved paths compared, so `..` traversal and
 * absolute paths both fail closed rather than being normalised into something plausible.
 *
 * Unknown argument shapes are allowed through deliberately: this gate exists to confine
 * *paths*, and a tool whose input carries none (an MCP call, a search string) is not a
 * filesystem access. Anything that looks like a path is checked, whatever tool asked.
 */
const PATH_KEYS = ['file_path', 'path', 'notebook_path', 'filePath', 'dir', 'directory', 'cwd'];

export function pathArgumentsOf(input: unknown): string[] {
  if (typeof input !== 'object' || input === null) return [];
  const record = input as Record<string, unknown>;
  const found: string[] = [];
  for (const key of PATH_KEYS) {
    const value = record[key];
    if (typeof value === 'string' && value.trim() !== '') found.push(value);
  }
  return found;
}

/**
 * `true` when every path argument resolves inside **one of** this run's roots.
 *
 * A run has one root today — its scratch workspace — and two when it is given a git worktree
 * (M17, `Plan §13`): the scratch directory it writes its deliverable in, and the worktree it
 * changes code in. Both are the run's; neither is anybody else's. Passing a *set* rather than
 * threading a second parameter is what keeps that a property of the gate: a caller cannot add
 * a root by editing a boolean, and `runService` names the roots in one place.
 *
 * An empty set (a dry run, or a session with no workspace) denies any path argument outright:
 * there is no directory to be inside of, so nothing can be.
 *
 * **Relative paths resolve against the first root**, which is the session's cwd. This is the
 * one place the two must agree, and the caller passes them in that order for exactly that
 * reason.
 */
export function isPathInsideRunRoots(roots: readonly string[], input: unknown): boolean {
  const paths = pathArgumentsOf(input);
  if (paths.length === 0) return true;
  const resolved = roots.filter((root) => root !== '').map((root) => resolve(root));
  if (resolved.length === 0) return false;
  const cwd = resolved[0] as string;

  return paths.every((candidate) => {
    const abs = isAbsolute(candidate) ? resolve(candidate) : resolve(cwd, candidate);
    return resolved.some((root) => {
      if (abs === root) return true;
      const rel = relative(root, abs);
      return rel !== '' && !rel.startsWith('..') && !isAbsolute(rel) && !rel.split(sep).includes('..');
    });
  });
}

/**
 * The single-root form, kept because it is the shape most call sites and every existing test
 * mean: *this run has one directory.* It is a thin wrapper rather than a duplicate, so there is
 * one containment algorithm and not two that agree until they do not.
 */
export function isPathInsideScratch(scratchDir: string, input: unknown): boolean {
  return isPathInsideRunRoots([scratchDir], input);
}

/** Refusal for a `wired_into` name nobody wired. Names the fix and who owns it. */
export function unknownConnectorError(unknown: string[]): ApiError {
  return new ApiError(
    'unknown_connector',
    `This agent lists connectors the runner does not know: ${unknown.join(', ')}.`,
    {
      hint: `Nothing was run, because "${unknown[0]}" would have no permissions to grant. Either wire the connector in the runner's registry or remove it from the agent's wired_into.`,
      retryable: false,
    },
  );
}
