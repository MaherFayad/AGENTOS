'use client';

import { useMemo } from 'react';
import type { ProjectStatus } from '@agnetos/contracts';
import { useEndpoint, type Resource } from './useEndpoint';

/**
 * `GET /api/projects` — what the project switcher lists (`Plan §9`, `Plan §23.10`,
 * `packages/contracts/src/project.ts`).
 *
 * ## The one thing this file is careful about
 *
 * **A project in this list is a project the coordinator *told us about*. It is not a
 * project we have observed working.** That distinction is the whole reason the parsing
 * below keeps `mounted` and `scopeEnforced` rather than flattening the payload to an
 * array of names:
 *
 * - `mounted` — the single project whose library this coordinator actually has on disk.
 *   In M15 exactly one library is mounted, so `projects[]` may legitimately list rows
 *   this process cannot serve. The contract says why it is reported rather than inferred:
 *   *"say which one it can rather than letting a switcher discover it by 404."*
 * - `scopeEnforced` — `false` means this database connection bypasses row-level security,
 *   so migration 0005's project isolation is **inert**. `null` means the coordinator did
 *   not say. Neither is `true`, and the switcher must not draw them as if they were: an
 *   isolation guarantee whose status nobody can see is a claim, and this repo has already
 *   shipped six configured-values-read-as-observed-ones.
 *
 * `budgetMonthlyUsd`, `hostAffinity` and `defaultAccountId` are deliberately **not** read
 * here. Each ships with a sibling `…Enforced: false` in the contract because nothing
 * enforces it yet, and the shell has no state in which drawing an unenforced cap is the
 * honest thing to do. They arrive when an enforcement point does.
 */

export interface ProjectRow {
  slug: string;
  name: string;
  status: ProjectStatus;
  /** True when this is the project whose library the coordinator has on disk. */
  mounted: boolean;
}

export interface ProjectsReading {
  projects: ProjectRow[];
  /** Slug of the mounted project, or `null` when the coordinator did not name one. */
  mounted: string | null;
  /** `true` only when the coordinator says isolation is enforced. `null` ⇒ not reported. */
  scopeEnforced: boolean | null;
}

const PROJECTS_INTERVAL_MS = 120_000;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const STATUSES: readonly ProjectStatus[] = ['active', 'paused', 'archived'];

function readStatus(value: unknown): ProjectStatus | null {
  return STATUSES.find((known) => known === value) ?? null;
}

export function parseProjects(json: unknown): ProjectsReading | null {
  if (!isRecord(json)) return null;
  const list = Array.isArray(json.projects) ? json.projects : null;
  if (list === null) return null;

  const mounted = typeof json.mounted === 'string' && json.mounted.length > 0 ? json.mounted : null;
  // Tri-state on purpose. `?? null` rather than `=== true`, so "not reported" survives as
  // itself instead of collapsing into "not enforced" — two different sentences.
  const scopeEnforced = typeof json.scopeEnforced === 'boolean' ? json.scopeEnforced : null;

  const projects: ProjectRow[] = [];
  for (const raw of list) {
    if (!isRecord(raw)) continue;
    const slug = typeof raw.slug === 'string' ? raw.slug : null;
    if (slug === null || slug.length === 0) continue;
    const status = readStatus(raw.status);
    if (status === null) continue;
    projects.push({
      slug,
      name: typeof raw.name === 'string' && raw.name.length > 0 ? raw.name : slug,
      status,
      mounted: slug === mounted,
    });
  }

  // An empty list is a legal answer ("this coordinator has no projects") and is rendered
  // as one. It is not the same as a malformed body, which is why the array check above is
  // the only thing that can return null.
  return { projects, mounted, scopeEnforced };
}

export function useProjectsEndpoint(): Resource<ProjectsReading> {
  return useEndpoint<ProjectsReading>('/api/projects', {
    intervalMs: PROJECTS_INTERVAL_MS,
    parse: parseProjects,
    notBuiltMessage:
      'This runner does not list projects yet, so the name in the address bar is the only thing that says which project you are looking at — nothing has confirmed it exists.',
    malformedMessage:
      'The project list came back in a shape this build does not understand, so the switcher cannot say which projects exist. That is a version mismatch here, not a missing project.',
    offlineMessage:
      "Can't reach the runner, so the project list is unknown. This box may be off the tailnet.",
  });
}

/**
 * What the shell knows about the project it is currently showing.
 *
 * Five fields, and the reason there are five rather than one string is that "which
 * project am I in" has five different answers depending on who was asked:
 *
 * | `slug` | `confirmed` | reading |
 * |---|---|---|
 * | a slug | `true` | the URL names it and the coordinator lists it |
 * | a slug | `false` | the URL names it; the coordinator does not list it, or was not reachable |
 * | `null` | `false` | the URL does not say — a legacy link, being resolved |
 */
export interface ProjectScope {
  /** From the URL. `null` ⇒ this URL does not name a project. */
  slug: string | null;
  /** Display name, only when the coordinator supplied one. Falls back to the slug. */
  name: string | null;
  /** True only when `slug` appears in the coordinator's list. */
  confirmed: boolean;
  /** True when the coordinator says it has this project's library on disk. */
  isMounted: boolean;
  /** The coordinator's mounted slug, or `null` when unknown. */
  mounted: string | null;
  /** Every project the coordinator listed. Empty while unknown — never invented. */
  options: ProjectRow[];
  /** `true` only when isolation is reported enforced; `null` ⇒ not reported. */
  scopeEnforced: boolean | null;
  /** Why the scope is not confirmed, in a sentence, or `null` when it is. */
  message: string | null;
}

export function useProjectScope(slug: string | null, projects: Resource<ProjectsReading>): ProjectScope {
  return useMemo<ProjectScope>(() => {
    if (projects.state !== 'ready') {
      return {
        slug,
        name: null,
        confirmed: false,
        isMounted: false,
        mounted: null,
        options: [],
        scopeEnforced: null,
        message:
          projects.state === 'unavailable'
            ? projects.message
            : 'Asking the runner which projects exist.',
      };
    }

    const { projects: options, mounted, scopeEnforced } = projects.data;
    const row = slug === null ? undefined : options.find((project) => project.slug === slug);

    return {
      slug,
      name: row?.name ?? null,
      confirmed: row !== undefined,
      isMounted: row?.mounted ?? false,
      mounted,
      options,
      scopeEnforced,
      message:
        slug === null
          ? 'This address does not say which project it is about.'
          : row !== undefined
            ? null
            : `The runner does not list a project called “${slug}”. It serves ${
                mounted === null ? 'no project it was willing to name' : `“${mounted}”`
              }.`,
    };
  }, [slug, projects]);
}
