'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { ViewMount } from './ViewMount';
import { useShell } from './ShellContext';

/**
 * What answers a URL that does not name a project — `/map/sales`, `/dashboards/pipeline`,
 * a link someone bookmarked before M15, the `/` redirect.
 *
 * ## Why this is not just a redirect in `next.config`
 *
 * A static redirect would have to know the project slug at build time, and the build does
 * not know it: which library a coordinator mounts is that coordinator's configuration
 * (`apps/runner/src/lib/project.ts`), not the web image's. Baking one in would ship an
 * app that silently relabels one deployment's data with another's project name — which is
 * the precise failure the path segment exists to prevent, reintroduced one layer up.
 *
 * So the resolver **asks**. `GET /api/projects` reports `mounted`: the one project whose
 * library this coordinator actually has on disk. The URL is then rewritten to name it and
 * the reader sees the project in the address bar before any of its data is drawn.
 *
 * ## Is that an ambient default by another name? No, and the difference is testable
 *
 * The contract's objection to an ambient default is that it lets **one project's data be
 * served under another project's name** — the scope is decided by something the reader
 * cannot see. Here:
 *
 * 1. nothing is served in this state at all — no view is mounted under an unnamed project;
 * 2. the slug comes from the **coordinator's own report**, not from a client-side guess,
 *    a cookie, a header or "the first one in the list";
 * 3. it is written into the URL with `replace`, so the very next thing the reader sees is
 *    a link that says which project they are in — and can be pasted to someone else;
 * 4. when the coordinator cannot be asked, **nothing is picked.** The screen says the link
 *    does not name a project and that we could not find out which one to use.
 *
 * Point 4 is the one that makes the other three a design rather than a rationalisation.
 * A resolver that fell back to `'agentos'` when the runner was unreachable would be an
 * ambient default with extra steps.
 *
 * `replace`, not `push`: the unscoped URL is not a place, and leaving it in the history
 * would make the back button walk into a redirect loop.
 *
 * ## Who still sends unscoped links, on purpose
 *
 * - **`public/manifest.webmanifest`** — `start_url: "/map"` and the three shortcuts. The
 *   manifest is a static file baked into the web image, so it *cannot* name a project
 *   without naming the same one on every deployment. It stays unscoped and lands here;
 *   this is the clearest illustration of why the resolver asks rather than assumes.
 * - **Push deep links** (`sessions/push/payload.ts`, §3.6). A notification payload has no
 *   project field yet — `sessions-relay-engineer`'s to add — so tapping one resolves
 *   through here. It works; it costs a frame.
 * - **Anything bookmarked before M15.**
 */
export function LegacyRouteResolver(): React.JSX.Element {
  const router = useRouter();
  const pathname = usePathname() ?? '/map';
  const { projects } = useShell();

  const mounted = projects.state === 'ready' ? projects.data.mounted : null;

  useEffect(() => {
    if (mounted === null) return;
    router.replace(`/p/${mounted}${pathname}`);
  }, [mounted, pathname, router]);

  if (projects.state === 'loading') {
    return (
      <ViewMount title="Finding your project" owner="shell-navigation-engineer" spec="Plan §9">
        This link does not say which project it is about. Asking the runner which one it
        has mounted.
      </ViewMount>
    );
  }

  if (projects.state === 'unavailable') {
    return (
      <ViewMount title="This link does not name a project" owner="shell-navigation-engineer" spec="Plan §9">
        {projects.message} Every address in this app carries its project —{' '}
        <code>/p/&lt;project&gt;/map</code> — so a link can be handed to a phone and still
        mean one thing. Nothing has been picked for you, because picking would be a guess
        about whose data you are looking at.
      </ViewMount>
    );
  }

  if (mounted === null) {
    return (
      <ViewMount title="No project to open" owner="shell-navigation-engineer" spec="Plan §9">
        The runner answered but did not name a mounted project, so there is nothing to
        redirect this link to. Nothing is missing from your libraries — this coordinator
        has not been told which one to serve.
      </ViewMount>
    );
  }

  // `mounted` is known; the effect above is already navigating. Anything drawn here is on
  // screen for one frame, so it says what is happening rather than nothing.
  return (
    <ViewMount title="Opening" owner="shell-navigation-engineer" spec="Plan §9">
      Sending you to <code>{mounted}</code>, the project this runner has mounted.
    </ViewMount>
  );
}
