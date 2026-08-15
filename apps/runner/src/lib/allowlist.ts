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
import { ApiError } from './errors';

export interface Connector {
  /** Human label — what the drawer's `WIRED INTO` line shows. */
  label: string;
  /**
   * Concrete tool names this connector grants. A trailing `*` is a prefix match, which is
   * how MCP servers expose a family of tools under one connector name.
   */
  tools: readonly string[];
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
  exa: { label: 'Exa', tools: ['mcp__exa__*'], note: 'Neural search MCP.' },
  firecrawl: { label: 'Firecrawl', tools: ['mcp__firecrawl__*'], note: 'Page scraping MCP.' },
  'web-search': { label: 'Web search', tools: ['WebSearch'] },
  'web-fetch': { label: 'Web fetch', tools: ['WebFetch'] },

  // --- the scratch workspace ------------------------------------------------
  // Scoped to the per-run scratch cwd by the session's working directory, which is
  // destroyed after artifact extraction. An agent that needs to write its output file
  // declares `workspace`; one that only reasons does not, and then genuinely cannot write.
  workspace: {
    label: 'Scratch workspace',
    tools: ['Read', 'Write', 'Edit', 'Glob', 'Grep'],
    note: 'Read/write inside the per-run scratch dir only (§3.2).',
  },
  shell: {
    label: 'Shell',
    tools: ['Bash'],
    note: 'Deliberately separate from `workspace`. Most agents must not have it.',
  },

  // --- delivery / data ------------------------------------------------------
  slack: { label: 'Slack', tools: ['mcp__slack__*'] },
  gmail: { label: 'Gmail', tools: ['mcp__gmail__*'], note: 'Draft and send; send is gated by approval: required.' },
  hubspot: { label: 'HubSpot', tools: ['mcp__hubspot__*'], note: 'CRM system of record.' },
  postgres: { label: 'Postgres', tools: ['mcp__postgres__*'], note: 'Agent output rows (§2.5).' },
  langfuse: { label: 'Langfuse', tools: ['mcp__langfuse__*'], note: 'Read-only, for the auditor.' },

  // --- version control ------------------------------------------------------
  // Grants the *tool*, not the write boundary. Which paths a commit may touch is decided
  // by `assertInsideAgents` / `assertInsideCompany` in config.ts, on the runner's side of
  // the wire, where a prompt cannot argue with it (ADR-002, ADR-007).
  git: {
    label: 'Git',
    tools: ['mcp__git__*'],
    note: 'Repo history. Write paths are bounded by the runner, not by this grant.',
  },

  // --- the second brain (§3.3) ---------------------------------------------
  // The company-interview agent is the one thing that may write COMPANY.md. It is a
  // connector rather than an implicit capability so it shows up in `WIRED INTO` like
  // everything else — the interview agent's power should be visible on the map.
  'company-brain': {
    label: 'Company brain',
    tools: ['mcp__company__*'],
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
