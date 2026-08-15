/* =============================================================================
 * sessions/relay/envelope.ts — the server-side allowlist (spec §3.1, ADR-005)
 *
 * Our proxy sits between the browser and happy-server. It is the one place in
 * this feature where code runs on a machine other than the user's, so it is the
 * one place where a leak could happen — and the defence is not "we were careful
 * when we wrote it", it is an allowlist.
 *
 * Every row leaving the proxy is REBUILT from a fixed set of envelope keys.
 * Not filtered — rebuilt. If upstream adds a plaintext `title` field in some
 * future release, it does not reach the client by accident, because nothing
 * copies unknown keys. `no-plaintext-boundary.test.mjs` asserts exactly this
 * with a row that carries deliberately-poisoned plaintext fields.
 *
 * NODE-LOADABLE LEAF: no runtime imports.
 * ========================================================================== */

import type { SessionEnvelope, TranscriptEnvelope } from '../types';

/**
 * The complete set of fields the relay and our proxy may pass on for a session.
 * Ids, a cursor, a clock, a boolean, and a sealed box. Nothing a human wrote.
 *
 * Adding a key here is a security decision. Justify it in an ADR, not a commit
 * message.
 */
export const SESSION_ENVELOPE_KEYS = [
  'id',
  'seq',
  'updatedAt',
  'active',
  'encryptedMetadata',
] as const;

/** Same rule for transcript entries. `ciphertext` is the only payload. */
export const TRANSCRIPT_ENVELOPE_KEYS = [
  'id',
  'seq',
  'at',
  'ciphertext',
] as const;

const str = (v: unknown, field: string): string => {
  if (typeof v !== 'string' || v.length === 0) {
    throw new Error(`relay: envelope field "${field}" is not a string`);
  }
  return v;
};

const num = (v: unknown, field: string): number => {
  const n = typeof v === 'string' ? Number(v) : v;
  if (typeof n !== 'number' || !Number.isFinite(n)) {
    throw new Error(`relay: envelope field "${field}" is not a number`);
  }
  return n;
};

/**
 * Rebuild one session row from an upstream response.
 *
 * Note the shape of this function: it never spreads `row`. Every property is
 * named. That is the whole point.
 */
export function sanitizeSessionRow(row: Record<string, unknown>): SessionEnvelope {
  return {
    id: str(row.id, 'id'),
    seq: num(row.seq ?? 0, 'seq'),
    updatedAt: num(row.updatedAt ?? row.updated_at ?? 0, 'updatedAt'),
    active: Boolean(row.active),
    encryptedMetadata: str(
      row.encryptedMetadata ?? row.metadata ?? '',
      'encryptedMetadata',
    ),
  };
}

/** Rebuild one transcript row. Same discipline. */
export function sanitizeTranscriptRow(row: Record<string, unknown>): TranscriptEnvelope {
  return {
    id: str(row.id, 'id'),
    seq: num(row.seq, 'seq'),
    at: num(row.at ?? row.createdAt ?? 0, 'at'),
    ciphertext: str(row.ciphertext ?? row.content ?? '', 'ciphertext'),
  };
}

export function sanitizeSessionList(rows: unknown): SessionEnvelope[] {
  if (!Array.isArray(rows)) throw new Error('relay: expected an array of sessions');
  return rows.map((r) => sanitizeSessionRow(r as Record<string, unknown>));
}

export function sanitizeTranscript(rows: unknown): TranscriptEnvelope[] {
  if (!Array.isArray(rows)) throw new Error('relay: expected an array of entries');
  return rows.map((r) => sanitizeTranscriptRow(r as Record<string, unknown>));
}

/* -------------------------------------------------- bodies going the other way */

/**
 * The body for `POST /api/sessions/:id/input`.
 *
 * What the user typed is sealed in the browser first; this function only ever
 * sees the base64 box. There is no overload that takes a string of prose, so
 * "just send the text for now" is not a thing you can do by accident.
 */
export function inputBody(ciphertext: string): { ciphertext: string } {
  if (!ciphertext) throw new Error('relay: refusing to send an empty input box');
  return { ciphertext: str(ciphertext, 'ciphertext') };
}

/**
 * The body for `POST /api/sessions/:id/permission` — the Allow / Deny pills.
 *
 * `requestId` is an opaque relay-issued id and `allow` is a boolean, so this
 * one body is legitimately plaintext: it reveals that a decision was made, not
 * what was decided about. The tool name and the command stay sealed.
 */
export function permissionBody(
  requestId: string,
  allow: boolean,
): { requestId: string; allow: boolean } {
  return { requestId: str(requestId, 'requestId'), allow: Boolean(allow) };
}

/* ------------------------------------------------------------------- logging */

/**
 * The only value from this feature that may be written to a server log.
 *
 * Not the ciphertext either: an encrypted transcript in a log file is a
 * ciphertext the day someone loses a key, and it is never useful for debugging
 * a proxy. Ids and sizes are.
 */
export function logSafe(row: {
  id: string;
  seq?: number;
  ciphertext?: string;
  encryptedMetadata?: string;
}): { id: string; seq?: number; bytes: number } {
  const payload = row.ciphertext ?? row.encryptedMetadata ?? '';
  return { id: row.id, seq: row.seq, bytes: payload.length };
}
