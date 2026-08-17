/**
 * Provenance for the drawer header — `Plan §23.6`, `Plan §10`, ADR-014 (accepted 2026-08-17).
 *
 * Answers one question at a glance: **is the agent in front of you the global one, this
 * project's own, or a fork of the global one that has since moved?**
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * IT IS A PROJECTION OF `source_ref`, AND OF NOTHING ELSE
 *
 * ADR-014 §2 draws the line this file is built on:
 *
 *   | `agent_ref`  | `{project}/{department}/{slug}` | the addressable identity |
 *   | `source_ref` | `{layer}:{path}@{digest}`       | which file won, at what content |
 *
 * Provenance is the second one. The drawer therefore **parses** it out of the cascade's own
 * string and holds nothing of its own: there is no `layer` field on the drawer's model, no
 * remembered badge state, nothing a stale render could keep saying after the cascade
 * changed its mind. `packages/contracts/src/project.ts` builds that string
 * (`sourceRef(layer, path, sha256)`); this file is its only reader in the web app, and if
 * the grammar ever changes, exactly one function fails.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHERE THE DRAWER CAN ACTUALLY GET IT TODAY — ONE PLACE, AND IT IS NOT THE ONE YOU WANT
 *
 * `SseStartData.sourceRef` (`packages/contracts/src/api.ts`) carries it, and that
 * contract's own comment assigns the render to us:
 *
 *   > `drawer-engineer` renders the layer half of this as the provenance badge
 *   > (`⌂` global · `▣` project) in the drawer header.
 *
 * So a run tells us. **`GET /api/agents/:slug` does not** — `AgentDetail` is
 * `{slug, path, frontmatter, body, runnable}` and carries no `sourceRef`, and the route
 * behind it (`loadAgent`) does not go through `resolveThroughCascade` at all; it reads
 * `<repo>/agents/{department}/{slug}/SKILL.md` directly. There is no field to read and
 * inventing one would be a guess wearing a badge.
 *
 * That is why `unknown` exists below and why it is the default the drawer opens on. It is
 * `unknown`, not `global`, for exactly the reason `unpriced` is not `$0.00` two sections
 * further down the same drawer: the honest empty state is the one that does not have to be
 * unlearned. The endpoint that has to carry it is named in
 * `comms/handoffs/M15-drawer-engineer-provenance-header.md` and requested by message —
 * `AgentDetail.sourceRef`, same grammar, from `resolveThroughCascade`. When it lands,
 * `provenanceOfAgent` gains one call site and nothing else in the drawer changes.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * THREE OF THE BADGE'S FIVE STATES ARE UNREACHABLE, DELIBERATELY
 *
 * All three are **states of a comparison**, not of a field. ADR-014 §4.3: `fork` is *"parent
 * resolves and its digest equals `forked_from.digest`"*, `drifted` is *"digest differs"*,
 * `orphaned` is *"parent slug no longer resolves"* — each one is the answer to a question
 * somebody has to actually ask.
 *
 * Since ADR-014 was accepted, `forked_from: {ref, commit, digest}` **is** in
 * `frontmatter-schema.md`, so `AgentDetail.frontmatter` may well carry one. That makes the
 * temptation concrete and it is still refused: **nothing computes the comparison.** The
 * cascade contract's own §11 says so — *"`ProvenanceBadge` exists and the drawer has the
 * header slot; nothing computes a digest comparison — not built."* Rendering `fork` off the
 * presence of the field would announce *"and it still matches its parent"* (the badge's own
 * accessible sentence) on the strength of a digest nobody fetched, which is the same class of
 * claim as a plausible zero. A fork whose parent we have not checked is a fork we do not know
 * the state of, and the primitive has no state for that — correctly, because there is nothing
 * useful to say yet.
 *
 * They arrive when the resolver does, through this same function, with no change to any call
 * site. `provenance.test.ts` holds a tripwire that should fail on that day.
 *
 * Owner: drawer-engineer · Consumes: ADR-014 · `packages/contracts/src/project.ts` ·
 * `packages/contracts/src/api.ts` (owner: `runner-engineer`)
 */

import type { CascadeLayer } from '@agnetos/contracts';
import type { ProvenanceState } from '@/components/primitives';

/** The three parts of `{layer}:{path}@{digest}`, once it has been vouched for. */
export interface ResolvedSource {
  layer: CascadeLayer;
  /** Repo-relative path of the file that won. Not rendered; it is the reason, not the label. */
  path: string;
  /** `sha256:…` of the bytes that ran. */
  digest: string;
}

/**
 * What the header renders.
 *
 * `unknown` carries no state and takes no default — the primitive refuses one on purpose
 * (tokens contract §10, "a default here would be a provenance claim spent by a call site
 * that never made it"), and so does this.
 */
export type DrawerProvenance =
  | { kind: 'known'; state: ProvenanceState; source: ResolvedSource }
  | { kind: 'unknown' };

export const PROVENANCE_UNKNOWN: DrawerProvenance = { kind: 'unknown' };

/** The layer vocabulary, as a table rather than a cast: an unknown word stays unknown. */
const LAYERS: Readonly<Record<string, CascadeLayer>> = {
  global: 'global',
  project: 'project',
  override: 'override',
};

/**
 * Layer → badge state.
 *
 * **`override` is `project`, and that is ADR-014's word, not a simplification of mine.**
 * §4.1: *"**Override** — same `(department, slug)`, an L1 or L2 file, Class C narrowing
 * only. Badge: `▣ project`."* L1 (the project library) and L2 (`agents/_overrides/**`) are
 * one answer to the reader's question — *this project's own* — and the badge has no sixth
 * silhouette for the difference. Which file it was is `source.path`, kept for the run
 * console and the handoff rather than spent on a mark nobody could tell apart at 12px.
 */
const BADGE_STATE: Readonly<Record<CascadeLayer, ProvenanceState>> = {
  global: 'global',
  project: 'project',
  override: 'project',
};

/**
 * `{layer}:{path}@{digest}` → its parts, or `null` if it is not that.
 *
 * Strict on the grammar and silent about it, because the caller's only two outcomes are
 * "render this" and "render unknown" — and a ref we cannot read is a thing we do not know,
 * which is precisely what `unknown` says.
 *
 * The split is `indexOf(':')` for the layer and `lastIndexOf('@')` for the digest, not a
 * single regex over the middle: a path may legally contain both characters (a Windows
 * absolute path when `relative()` upstream could not shorten it, an `@`-scoped folder), and
 * a greedy read of either end is how a path silently becomes half a digest.
 */
export function parseSourceRef(value: unknown): ResolvedSource | null {
  if (typeof value !== 'string') return null;

  const colon = value.indexOf(':');
  if (colon <= 0) return null;
  const layer = LAYERS[value.slice(0, colon)];
  if (!layer) return null;

  const rest = value.slice(colon + 1);
  const at = rest.lastIndexOf('@');
  if (at <= 0) return null;

  const path = rest.slice(0, at);
  const digest = rest.slice(at + 1);
  // The algorithm is checked, the length is not: `sha256:` is the contract's word, while a
  // digest's width is the runner's business and this file never renders it.
  if (path === '' || !/^sha256:[0-9a-f]+$/i.test(digest)) return null;

  return { layer, path, digest };
}

/** One `source_ref` → what the header shows. Anything unreadable is `unknown`, never a guess. */
export function provenanceOfSourceRef(value: unknown): DrawerProvenance {
  const source = parseSourceRef(value);
  return source ? { kind: 'known', state: BADGE_STATE[source.layer], source } : PROVENANCE_UNKNOWN;
}

/** The slice of run state this needs. Structural, so a test does not build a whole console. */
export interface RunProvenanceSource {
  /** `department/agent-slug`, from the `start` event. */
  agent?: string;
  /** `{layer}:{path}@sha256:…`, from the `start` event. */
  sourceRef?: string;
}

/**
 * Provenance of the agent whose drawer is open.
 *
 * **The `agent` guard is the whole function.** One `useRunStream` serves the drawer for as
 * long as it is mounted, and closing one agent's drawer to open another does not clear a
 * finished run — so without this check the second agent's header would wear the first
 * agent's layer, confidently and wrongly. A `source_ref` is a fact about *one run of one
 * agent*; attributing it to a different agent is the fabrication this badge exists to
 * prevent, arrived at from the inside.
 *
 * What it claims when it does render is narrow and true: *the file that won the cascade the
 * last time this agent ran in this session*. Resolution is deterministic and precomputed
 * (ADR-014 decision 9), so that is also what would win now unless a file changed underneath
 * us — but the claim is anchored to an event that actually happened, which is the only kind
 * this drawer is allowed to make.
 */
export function provenanceOfAgent(slug: string | null, run: RunProvenanceSource): DrawerProvenance {
  if (!slug || run.agent !== slug) return PROVENANCE_UNKNOWN;
  return provenanceOfSourceRef(run.sourceRef);
}
