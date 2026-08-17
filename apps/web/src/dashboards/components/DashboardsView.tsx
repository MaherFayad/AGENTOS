'use client';

/**
 * The carousel page (§2.4).
 *
 * Panels arrive twice, on purpose: `loadPanels()` reads `panels/*.json` from disk on the
 * server so the cards exist with no runner at all, and this component re-asks the runner
 * **only when that came back empty**. The second read is the one that used to be wrong.
 *
 * ## Why the client fetch is project-scoped, and why there is no fallback
 *
 * It called `/api/panels`, which M15 replaced with `/api/p/:project/panels` (ADR-015 Q1).
 * The unscoped path is still mounted and answers **400 `project_scope_missing`** —
 * `LEGACY_UNSCOPED_PATHS` keeps it there so a stale client gets a named refusal instead of
 * another project's rows. This component caught that 400 and printed *"No Command Centers
 * to show. Add a panels/\*.json file"*: a routing fault reported as an empty folder, which
 * would have sent someone to look in the right place for the wrong reason.
 *
 * So the URL is built from `RUNNER_ROUTES.panels.path` through `projectApiUrl` — the same
 * seam the shell's search index uses — and **`null` means do not ask.** Calling the
 * unscoped path deliberately would convert the runner's deliberate 400 into a shrug, and
 * there is no default project to substitute (ADR-015 Q2).
 *
 * The three ways to have no carousel are now three sentences, because they have three
 * different fixes: the address names no project · the runner refused or could not be
 * reached · there is genuinely nothing in `panels/`.
 *
 * Owner: dashboards-engineer · Spec §2.4 · contracts/panel-schema.md
 */

import { useEffect, useState } from 'react';
import { RUNNER_ROUTES, type Panel } from '@agnetos/contracts';
import { projectApiUrl, NO_PROJECT_SENTENCE } from '@/components/shell/useSearchIndex';
import { useProjectSegment } from '@/components/shell/useProjectHref';
import { normalizePanelPayload } from '../data/normalize';
import { Carousel } from './Carousel';
import { EmptyLine } from './states';
import s from '../dashboards.module.css';

/** There is a `panels/` folder and it is empty — the one case that is nobody's fault. */
const NOTHING_DEFINED =
  'No Command Centers to show. Add a panels/*.json file — the carousel is a projection of that folder.';

export function DashboardsView({
  panels,
  error,
}: {
  panels: readonly Panel[];
  error?: string;
}): React.JSX.Element {
  const project = useProjectSegment();
  const [list, setList] = useState<readonly Panel[]>(panels);
  const [message, setMessage] = useState<string | undefined>(error);

  useEffect(() => {
    setList(panels);
    setMessage(error);
  }, [panels, error]);

  useEffect(() => {
    if (panels.length > 0) return;

    const url = projectApiUrl(RUNNER_ROUTES.panels.path, project);
    if (url === null) {
      // Not an outage and not an empty folder: this address does not say whose dashboards
      // it wants. Nothing is requested, and the server-side `error` still wins if it has
      // something more specific to say about the folder itself.
      setMessage(error ?? NO_PROJECT_SENTENCE);
      return;
    }

    let cancelled = false;
    fetch(url, { headers: { accept: 'application/json' } })
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((json) => {
        if (cancelled) return;
        const next = normalizePanelPayload(json);
        if (next.length) setList(next);
        else setMessage(error ?? NOTHING_DEFINED);
      })
      .catch((reason: unknown) => {
        if (cancelled) return;
        // The request failed. That is not the same fact as "there are no panels", and
        // saying the second when the first happened is what this file was repaired for.
        setMessage(
          error ??
            `Could not read the dashboard list from the runner (${
              reason instanceof Error ? reason.message : 'no response'
            }). The panels on disk, if any, are still the source of truth — this says nothing about what is in panels/.`,
        );
      });
    return () => {
      cancelled = true;
    };
  }, [panels, error, project]);

  if (list.length === 0) {
    return (
      <div className={s.view}>
        <div className="grid h-full place-items-center px-6">
          <EmptyLine>{message ?? NOTHING_DEFINED}</EmptyLine>
        </div>
      </div>
    );
  }

  return (
    <div className={s.view}>
      <Carousel panels={list} />
    </div>
  );
}
