'use client';

/* =============================================================================
 * components/PermissionCard.tsx — the copper action card (§3.1)
 *
 * The one place in this tab where colour is correct. A session waiting on a
 * permission prompt is "alive, waiting on you", which is exactly what the
 * copper accent means everywhere else in this product (§1.3).
 *
 * Three rules this component exists to keep:
 *
 *  1. It shows WHAT IS BEING PERMITTED, verbatim. "Allow this tool?" with the
 *     command hidden is a consent dialog that trains people to tap Allow.
 *  2. Allow and Deny are the same size, both ≥48px, side by side. Neither is
 *     styled as the dangerous one — denying is an ordinary, safe answer.
 *  3. It is docked above the composer, never inline in the scroller, so it is
 *     reachable without scrolling however long the transcript is.
 * ========================================================================== */

import { useT } from '@/i18n';
import s from '../sessions.module.css';
import type { PermissionRequest } from '../types';

export function PermissionCard({
  request,
  busy,
  onDecide,
}: {
  request: PermissionRequest;
  busy: boolean;
  onDecide: (requestId: string, allow: boolean) => void;
}): React.JSX.Element {
  const t = useT();

  return (
    <section className={s.permission} aria-labelledby={`perm-${request.requestId}`}>
      {/* Natural case in the catalogue; the caps come from `.u-label`, which
          also carries the Arabic compensation for the tracking it drops (§1.4). */}
      <span className={`u-label ${s.permissionEyebrow}`}>
        {t('sessions.permission.eyebrow')}
      </span>
      <h2 className={`u-ltr-island ${s.permissionTool}`} id={`perm-${request.requestId}`}>
        {request.tool}
      </h2>
      <p className={s.permissionSummary}>{request.summary}</p>

      {/* The command, verbatim. Program text does not mirror (§1.4). */}
      {request.detail?.length ? (
        <pre className={`u-ltr-island ${s.permissionDetail}`}>{request.detail.join('\n')}</pre>
      ) : null}

      <div className={s.permissionActions}>
        <button
          type="button"
          className={`${s.pill} ${s.pillSecondary}`}
          disabled={busy}
          onClick={() => onDecide(request.requestId, false)}
        >
          {t('sessions.permission.deny')}
        </button>
        <button
          type="button"
          className={`${s.pill} ${s.pillPrimary}`}
          disabled={busy}
          onClick={() => onDecide(request.requestId, true)}
        >
          {t('sessions.permission.allow')}
        </button>
      </div>
    </section>
  );
}
