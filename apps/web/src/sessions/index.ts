/**
 * The SESSIONS feature (§3.1) — public surface.
 *
 * Anything not exported here is private to this feature and may change without
 * a message (comms/README.md). In particular `lib/e2e.ts`, the relay proxy and
 * the envelope allowlist are NOT public: they are the security boundary, and a
 * boundary with several front doors is not a boundary.
 *
 * Owner: sessions-relay-engineer.
 */

export { SessionsTab } from './components/SessionsTab';
export { SessionView } from './components/SessionView';
export type { SessionState, SessionMeta, DecryptedSession, PermissionRequest } from './types';
export { PUSH_KINDS, deepLinkFor, type PushKind, type PushPayload } from './push/payload';
