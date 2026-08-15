/* =============================================================================
 * sessions/relay/happy-adapter.ts — the only file that knows about Happy
 *
 * ADR-005 chose self-hosted `slopus/happy-server`. Everything upstream-specific
 * is confined here so that swapping relays later is this file plus compose, and
 * not a rewrite of the tab. The components, the crypto boundary and the push
 * flow all speak our own `SessionMeta` / `TranscriptEntry` types.
 *
 * IMPORTANT: these functions take ALREADY-DECRYPTED values. They run in the
 * browser, after `lib/e2e.ts` has opened the box. Nothing here ever touches the
 * network and nothing here ever runs on the server (ADR-005, consequence 1).
 *
 * Upstream's metadata shape is a version-pinned fact, not a stable public API,
 * so every field is read defensively and every unknown falls back to something
 * honest rather than something plausible.
 *
 * NODE-LOADABLE LEAF: no runtime imports.
 * ========================================================================== */

import type {
  PermissionRequest,
  SessionMeta,
  SessionState,
  TranscriptEntry,
  TranscriptKind,
} from '../types';

/** Upstream's decrypted session metadata, as far as we rely on it. */
interface HappyMetadata {
  name?: string;
  summary?: { text?: string };
  path?: string;
  machineId?: string;
  model?: string;
  startedAt?: number;
  usage?: { costUsd?: number; totalCostUsd?: number };
  state?: string;
  permissionRequest?: unknown;
  pendingPermission?: unknown;
  thinking?: boolean;
}

const s = (v: unknown, fallback: string): string =>
  typeof v === 'string' && v.trim() ? v.trim() : fallback;

const n = (v: unknown, fallback: number): number =>
  typeof v === 'number' && Number.isFinite(v) ? v : fallback;

/**
 * Derive the three states of §3.1.
 *
 * `waiting-permission` wins over everything else, because a session that is
 * both thinking and blocked is, to the human, blocked. Getting this precedence
 * backwards would hide the exact row the list exists to surface.
 */
export function deriveState(meta: HappyMetadata, active: boolean): SessionState {
  const raw = s(meta.state, '').toLowerCase();
  const pending = meta.permissionRequest ?? meta.pendingPermission;

  if (pending || raw === 'waiting-permission' || raw === 'permission_required') {
    return 'waiting-permission';
  }
  if (meta.thinking === true || raw === 'working' || raw === 'running') return 'working';
  if (!active) return 'idle';
  return raw === 'idle' ? 'idle' : 'working';
}

/**
 * Map decrypted upstream metadata onto our own type.
 *
 * `billing` is hardcoded, not read from upstream, and that is deliberate:
 * Part V says interactive sessions run on the human's Claude subscription
 * through Happy wrapping the CLI. The runner's capped API-key workspace is a
 * different pot of money. A relay that started reporting a billing source
 * would not get to change what this tab claims.
 */
export function toSessionMeta(
  decrypted: unknown,
  envelope: { updatedAt: number; active: boolean },
): SessionMeta {
  const meta = (decrypted ?? {}) as HappyMetadata;
  const cost = meta.usage?.costUsd ?? meta.usage?.totalCostUsd;

  return {
    name: s(meta.name, s(meta.summary?.text, 'Untitled session')),
    repo: s(meta.path, 'unknown path'),
    model: s(meta.model, 'unknown model'),
    state: deriveState(meta, envelope.active),
    startedAt: n(meta.startedAt, envelope.updatedAt),
    costUsd: n(cost, 0),
    billing: 'claude-subscription',
  };
}

/* ---------------------------------------------------------------- transcript */

interface HappyMessage {
  role?: string;
  type?: string;
  content?: unknown;
  text?: string;
  tool?: { name?: string; input?: unknown };
  permission?: {
    id?: string;
    tool?: string;
    summary?: string;
    detail?: string[];
    input?: Record<string, unknown>;
  };
}

const KIND_BY_ROLE: Record<string, TranscriptKind> = {
  user: 'user',
  human: 'user',
  assistant: 'assistant',
  agent: 'assistant',
  tool: 'tool',
  tool_use: 'tool',
  tool_result: 'tool',
  system: 'system',
};

/**
 * Flatten upstream's content union into the one thing a transcript shows: text.
 *
 * Whitespace is preserved exactly. These parts are streamed tokens, so a
 * trailing space is a word boundary, not formatting noise — trimming here
 * silently glues sentences together ("Readingthe file"). Do not "tidy" this.
 */
function toText(msg: HappyMessage): string {
  if (typeof msg.text === 'string') return msg.text;
  if (typeof msg.content === 'string') return msg.content;
  if (Array.isArray(msg.content)) {
    return msg.content
      .map((part) => {
        if (typeof part === 'string') return part;
        const text = (part as { text?: unknown })?.text;
        return typeof text === 'string' ? text : '';
      })
      .join('');
  }
  if (msg.tool?.name) return `${msg.tool.name}(…)`;
  return '';
}

/**
 * The permission card's content.
 *
 * `detail` is what the human is actually agreeing to — the command, the path,
 * the URL. It is rendered verbatim on the card, because "Allow this tool?" with
 * the tool hidden is a consent dialog that teaches people to tap Allow.
 */
function toPermission(msg: HappyMessage): PermissionRequest | undefined {
  const p = msg.permission;
  if (!p?.id) return undefined;

  const detail =
    p.detail ??
    (p.input
      ? Object.entries(p.input).map(
          ([k, v]) => `${k}: ${typeof v === 'string' ? v : JSON.stringify(v)}`,
        )
      : undefined);

  return {
    requestId: p.id,
    tool: s(p.tool, 'unknown tool'),
    summary: s(p.summary, `${s(p.tool, 'A tool')} wants to run`),
    detail: detail?.length ? detail : undefined,
  };
}

export function toTranscriptEntry(
  decrypted: unknown,
  envelope: { id: string; seq: number; at: number },
): TranscriptEntry {
  const msg = (decrypted ?? {}) as HappyMessage;
  const permission = toPermission(msg);
  const kind: TranscriptKind = permission
    ? 'permission'
    : (KIND_BY_ROLE[s(msg.role, s(msg.type, ''))] ?? 'system');

  return {
    id: envelope.id,
    seq: envelope.seq,
    at: envelope.at,
    kind,
    text: toText(msg),
    permission,
  };
}

/**
 * The permission prompt the view must keep reachable without scrolling: the
 * newest unresolved one. Resolved prompts stay in the transcript as history.
 */
export function pendingPermission(
  entries: readonly TranscriptEntry[],
  resolved: ReadonlySet<string>,
): PermissionRequest | null {
  for (let i = entries.length - 1; i >= 0; i--) {
    const p = entries[i].permission;
    if (p && !resolved.has(p.requestId)) return p;
  }
  return null;
}
