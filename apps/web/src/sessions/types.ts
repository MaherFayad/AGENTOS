/* =============================================================================
 * sessions/types.ts — the shape of a remote Claude Code session (spec §3.1)
 *
 * There are two kinds of type in this file and the difference is the whole
 * security model:
 *
 *   ENVELOPE types  — what the relay and our proxy are allowed to see.
 *                     Ids, sequence numbers, timestamps, ciphertext. Nothing a
 *                     human wrote and nothing an agent said.
 *
 *   PLAINTEXT types — what exists only after client-side decryption, only in
 *                     the browser, only in memory. A value of one of these
 *                     types must never appear in a fetch body, a URL, a log
 *                     line, a Langfuse trace, or a push notification payload.
 *
 * If you find yourself wanting to send a plaintext type to the server, the
 * feature changes — not the threat model (ADR-005).
 * ========================================================================== */

/** §3.1 — the three states the list must show. */
export type SessionState = 'working' | 'waiting-permission' | 'idle';

/** Part V — interactive sessions bill to the human's Claude subscription, via
 *  Happy wrapping the CLI. The runner's capped API-key workspace is a
 *  different pot of money and this union exists so the UI can never blur them. */
export type BillingSource = 'claude-subscription' | 'runner-api-key';

/* ---------------------------------------------------------------- envelopes */

/**
 * A session row exactly as the relay stores it. Note what is missing: name,
 * repo, model, state, cost. Happy encrypts session metadata, so those live
 * inside `encryptedMetadata` and the server cannot read them — which is why
 * the SESSIONS list is sorted in the browser and not by a server query
 * (ADR-005, consequence 1).
 */
export interface SessionEnvelope {
  id: string;
  /** Monotonic per-session cursor. Reconnects resume from here. */
  seq: number;
  /** Epoch ms. The relay knows *when* something happened, never *what*. */
  updatedAt: number;
  /** Whether a daemon is currently attached. Not the same as `working`. */
  active: boolean;
  /** Base64 sealed box. Opaque to every server on the path. */
  encryptedMetadata: string;
}

/** One transcript entry as it crosses the wire: a cursor and a sealed box. */
export interface TranscriptEnvelope {
  id: string;
  seq: number;
  at: number;
  ciphertext: string;
}

/* --------------------------------------------------------------- plaintext */

/** Decrypted session metadata. Browser-only. */
export interface SessionMeta {
  name: string;
  repo: string;
  model: string;
  state: SessionState;
  /** Epoch ms the session started — `elapsed` is derived, never stored. */
  startedAt: number;
  costUsd: number;
  billing: BillingSource;
}

/** An envelope joined to its decrypted metadata. Browser-only. */
export interface DecryptedSession {
  envelope: SessionEnvelope;
  meta: SessionMeta;
}

export type TranscriptKind =
  | 'user'
  | 'assistant'
  | 'tool'
  | 'system'
  | 'permission';

/**
 * A pending permission prompt. This is the copper action card, and the reason
 * §3.6 push exists: it is the state that costs the human time.
 *
 * `tool` and `detail` are shown verbatim on the card so the human can see
 * exactly what is being permitted before their thumb commits to it.
 */
export interface PermissionRequest {
  requestId: string;
  tool: string;
  summary: string;
  detail?: string[];
}

/** A decrypted transcript entry. Browser-only. */
export interface TranscriptEntry {
  id: string;
  seq: number;
  at: number;
  kind: TranscriptKind;
  text: string;
  /** Present only when `kind === 'permission'`. */
  permission?: PermissionRequest;
}

/* ------------------------------------------------------------- connections */

/**
 * A phone sleeps, a train enters a tunnel, a hotspot drops. The transcript
 * view reports this honestly rather than silently showing a stale log.
 */
export type ConnectionState =
  | 'connecting'
  | 'live'
  | 'reconnecting'
  | 'offline';

/** Uniform error shape from the API contract. `hint` is shown verbatim, so it
 *  is written for a human holding a phone. */
export interface ApiError {
  error: { code: string; message: string; hint?: string };
}
