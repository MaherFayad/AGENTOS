/**
 * Loading agents from `agents/**​/SKILL.md` — the runner's only source of truth about what
 * an agent is (Part IV: "Frontmatter is the single source of truth").
 *
 * Nothing in this service keeps its own copy of agent data, caches it across a change, or
 * accepts it from a request body. If a caller wants a different tool list, a different
 * schedule or a different approval gate, the way to get one is to change the file and
 * commit it.
 */
import { readFile, readdir } from 'node:fs/promises';
import { join, relative } from 'node:path';
import type { AgentDetail, RunInputValue } from '@agnetos/contracts';
import { ApiError, badRequest } from './errors';
import { agentSkillPath, isAgentSlug, type RunnerConfig } from './config';
import { parseFrontmatter, FrontmatterError } from './frontmatter';
import { resolveAllowlist, type ResolvedAllowlist } from './allowlist';

export interface AgentInputSpec {
  key: string;
  label: string;
  type: string;
  required: boolean;
  options?: string[];
}

export interface AgentRecord {
  slug: string;
  /** Repo-relative, for the API and for git. */
  path: string;
  absolutePath: string;
  name: string;
  department: string;
  data: Record<string, unknown>;
  body: string;
  allowlist: ResolvedAllowlist;
  approvalRequired: boolean;
  schedule: string | null;
  inputs: AgentInputSpec[];
  deliver: { slack?: string; email?: string };
}

const asString = (value: unknown, fallback = ''): string =>
  typeof value === 'string' ? value : value === undefined || value === null ? fallback : String(value);

function toStringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((v) => String(v));
  if (typeof value === 'string' && value.trim() !== '') return [value.trim()];
  return [];
}

function readInputs(value: unknown): AgentInputSpec[] {
  if (!Array.isArray(value)) return [];
  const specs: AgentInputSpec[] = [];
  for (const entry of value) {
    if (typeof entry !== 'object' || entry === null) continue;
    const row = entry as Record<string, unknown>;
    const key = asString(row.key).trim();
    if (key === '') continue;
    specs.push({
      key,
      label: asString(row.label, key),
      type: asString(row.type, 'text'),
      required: row.required === true,
      ...(Array.isArray(row.options) ? { options: row.options.map((o) => String(o)) } : {}),
    });
  }
  return specs;
}

function readDeliver(value: unknown): { slack?: string; email?: string } {
  if (typeof value !== 'object' || value === null) return {};
  const row = value as Record<string, unknown>;
  return {
    ...(typeof row.slack === 'string' ? { slack: row.slack } : {}),
    ...(typeof row.email === 'string' ? { email: row.email } : {}),
  };
}

/**
 * Build an `AgentRecord` from bytes that have **already been read**, at a path the caller
 * chose.
 *
 * Split out of `loadAgent` for the cascade (ADR-014 §1): at dispatch the file that runs is
 * whichever layer won, which may be the project library, an `_overrides/` file or a global
 * one — and it is the *same bytes the ceiling was derived from*, not a re-read. Re-reading
 * between the capability check and the run would open exactly the window the check exists
 * to close.
 */
export function recordFromSource(
  config: RunnerConfig,
  slug: string,
  source: string,
  absolutePath: string,
): AgentRecord {
  let parsed;
  try {
    parsed = parseFrontmatter(source);
  } catch (err) {
    const detail = err instanceof FrontmatterError ? err.message : 'unreadable frontmatter';
    throw new ApiError('invalid_frontmatter', `"${slug}" has frontmatter the runner cannot read: ${detail}.`, {
      hint: 'Fix the frontmatter in that SKILL.md and try again. Until it parses, this agent is also missing from the map — that is the same problem, not two.',
      retryable: false,
      cause: err,
    });
  }

  const data = parsed.data;
  const [department] = slug.split('/');
  const declaredDepartment = asString(data.department).trim();

  // Invariant 1 of the schema contract: the path segment must equal the field. Checked
  // here as well as in the validator because a mismatch means the drawer and the map
  // disagree about which branch this node lives on, and the runner is the one process
  // that can see both.
  if (declaredDepartment !== '' && declaredDepartment !== department) {
    throw new ApiError(
      'invalid_frontmatter',
      `"${slug}" says department: ${declaredDepartment} but lives under agents/${department}/.`,
      {
        hint: 'Move the folder or fix the department field so they match — the map places the node by path and labels it by field.',
        retryable: false,
      },
    );
  }

  const scheduleRaw = asString(data.schedule).trim();

  return {
    slug,
    path: relative(config.repoRoot, absolutePath).split('\\').join('/'),
    absolutePath,
    name: asString(data.name, slug),
    department: department ?? '',
    data,
    body: parsed.body,
    allowlist: resolveAllowlist(toStringArray(data.wired_into)),
    approvalRequired: asString(data.approval).trim().toLowerCase() === 'required',
    schedule: scheduleRaw === '' ? null : scheduleRaw,
    inputs: readInputs(data.inputs),
    deliver: readDeliver(data.deliver),
  };
}

/** Load one agent by `department/agent-slug`, from this project's library layer. */
export async function loadAgent(config: RunnerConfig, slug: string): Promise<AgentRecord> {
  const absolutePath = agentSkillPath(config, slug);

  let source: string;
  try {
    source = await readFile(absolutePath, 'utf8');
  } catch {
    throw new ApiError('agent_not_found', `No agent at "${slug}".`, {
      hint: `Nothing exists at agents/${slug}/SKILL.md. Check the id on the map — it is the folder path, not the display name.`,
      retryable: false,
    });
  }

  return recordFromSource(config, slug, source, absolutePath);
}

/** Every agent in the library. Unparseable files are skipped with a warning, not thrown. */
export async function listAgents(
  config: RunnerConfig,
  onSkip?: (slug: string, reason: string) => void,
): Promise<AgentRecord[]> {
  let departments: string[];
  try {
    const entries = await readdir(config.agentsDir, { withFileTypes: true });
    departments = entries.filter((e) => e.isDirectory() && !e.name.startsWith('_')).map((e) => e.name);
  } catch {
    return [];
  }

  const records: AgentRecord[] = [];
  for (const department of departments) {
    let agentDirs: string[] = [];
    try {
      const entries = await readdir(join(config.agentsDir, department), { withFileTypes: true });
      agentDirs = entries.filter((e) => e.isDirectory()).map((e) => e.name);
    } catch {
      continue;
    }
    for (const agent of agentDirs) {
      const slug = `${department}/${agent}`;
      if (!isAgentSlug(slug)) {
        onSkip?.(slug, 'slug is not kebab-case');
        continue;
      }
      try {
        records.push(await loadAgent(config, slug));
      } catch (err) {
        // A file that fails validation is excluded with a warning; it never renders
        // half-parsed (frontmatter-schema.md § Validation).
        onSkip?.(slug, err instanceof ApiError ? err.message : 'failed to load');
      }
    }
  }
  return records.sort((a, b) => a.slug.localeCompare(b.slug));
}

export function toAgentDetail(record: AgentRecord): AgentDetail {
  return {
    slug: record.slug,
    path: record.path,
    frontmatter: record.data,
    body: record.body,
    runnable: {
      tools: record.allowlist.tools,
      missingConnectors: record.allowlist.unknown,
      approvalRequired: record.approvalRequired,
      scheduled: record.schedule !== null,
    },
  };
}

/**
 * Check submitted inputs against the frontmatter `inputs[]` form.
 *
 * Unknown keys are dropped rather than passed through: everything in here is interpolated
 * into a prompt, and silently forwarding an unexpected field is how a caller starts
 * writing prompt text the agent's author never approved.
 */
export function validateInputs(
  record: AgentRecord,
  submitted: Record<string, RunInputValue> | undefined,
): Record<string, RunInputValue> {
  const provided = submitted ?? {};
  const clean: Record<string, RunInputValue> = {};

  for (const spec of record.inputs) {
    const value = provided[spec.key];
    const missing = value === undefined || value === null || value === '';
    if (missing) {
      if (spec.required) {
        throw badRequest(
          `"${spec.label}" is required to run ${record.name}.`,
          `Fill in ${spec.label} in the drawer and press Run again.`,
        );
      }
      continue;
    }
    if (spec.options && !spec.options.includes(String(value))) {
      throw badRequest(
        `"${value}" is not one of the allowed values for ${spec.label}.`,
        `Choose one of: ${spec.options.join(', ')}.`,
      );
    }
    clean[spec.key] = value;
  }

  return clean;
}
