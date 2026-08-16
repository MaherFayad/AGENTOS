/* =============================================================================
 * sessions/lib/stateKey.ts — session state → string-catalogue key (§3.1, §1.4)
 *
 * `lib/sort.ts` is a node-loadable leaf and must stay free of runtime imports,
 * so it cannot translate. This table is the seam: the state enum maps to a key,
 * and the component resolves it with `t()`. One row per `SessionState`, so a
 * new state is a compile error here rather than an English word leaking into an
 * Arabic screen.
 *
 * Owner: rtl-arabic-pdpl-specialist · Spec §1.4, §3.1.
 * ========================================================================== */

import type { StringKey } from '@/i18n';
import type { SessionState } from '../types';

export const STATE_KEY: Record<SessionState, StringKey> = {
  'waiting-permission': 'sessions.state.awaitingPermission',
  working: 'sessions.state.working',
  idle: 'sessions.state.idle',
};
