'use client';

import { useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Eyebrow, Pill } from './ui';

/**
 * §2.0 top-right: the copper eyebrow label plus their "Book a call" slot, which the spec
 * replaces with **"+ New session"** — the primary action of the whole app (spawn a Claude
 * session, §3.1).
 *
 * The eyebrow is the one piece of colour permitted in the chrome (§1.3: copper marks
 * "alive" things). Everything else in this bar is ivory/ink/line.
 *
 * The shell does not create the session itself — it routes to `/sessions?new=1` and
 * `sessions-relay-engineer` owns what happens there. Spawning is a relay concern and the
 * E2E encryption boundary is theirs to keep intact (§3.1).
 */
export const NEW_SESSION_HREF = '/sessions?new=1';

export function NewSessionAction(): React.JSX.Element {
  const router = useRouter();
  const start = useCallback(() => router.push(NEW_SESSION_HREF), [router]);

  return (
    <div className="flex items-center gap-3">
      <Eyebrow tone="copper" className="hidden md:block">
        NAVIGATION
      </Eyebrow>
      <Pill variant="primary" onClick={start} aria-label="Start a new Claude session">
        + New session
      </Pill>
    </div>
  );
}
