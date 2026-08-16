'use client';

import { useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Eyebrow, Pill } from './ui';
import { withProject } from './route';
import { useShell } from './ShellContext';

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
/**
 * `/p/:project/sessions?new=1`, or `/sessions?new=1` while the project is unknown.
 *
 * A function rather than the constant it replaced (M15): a session is started *in* a
 * project — that is which library its agents resolve from and which account pays for it
 * (`Plan §11`) — so a constant href would have started every session in whichever project
 * the resolver happened to land on.
 */
export function newSessionHref(project: string | null): string {
  return withProject('/sessions?new=1', project);
}

export function NewSessionAction(): React.JSX.Element {
  const router = useRouter();
  const { route } = useShell();
  const start = useCallback(() => router.push(newSessionHref(route.project)), [router, route.project]);

  return (
    <div className="flex items-center gap-3">
      {/* size="sm" is the spec's 10px/+0.35em; tone="alive" is the copper (§2.0, §1.3). */}
      <Eyebrow size="sm" tone="alive" className="hidden md:block">
        NAVIGATION
      </Eyebrow>
      <Pill variant="primary" onClick={start} aria-label="Start a new Claude session">
        + New session
      </Pill>
    </div>
  );
}
