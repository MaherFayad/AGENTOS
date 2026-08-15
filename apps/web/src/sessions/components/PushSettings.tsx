'use client';

/* =============================================================================
 * components/PushSettings.tsx — the phone half of §3.1 / the seam with §3.6
 *
 * Shell owns the PWA (`sw.js`, manifest, `enablePushNotifications`). This tab
 * owns the button that actually asks, because a permission prompt that fires
 * on mount is the fastest way to get a permanent `denied`.
 *
 * Default copy is content-free (ADR-005). "Show names on the lock screen" is
 * an explicit opt-in; the service worker still decrypts locally.
 * ========================================================================== */

import { useEffect, useState } from 'react';
import {
  disablePush,
  enablePush,
  isPushEnabled,
  notificationDetail,
  pushSupported,
  setNotificationDetail,
} from '@/lib/push';
import type { NotificationDetail } from '../push/payload';
import s from '../sessions.module.css';

export function PushSettings(): React.JSX.Element | null {
  const [enabled, setEnabled] = useState(false);
  const [detail, setDetail] = useState<NotificationDetail>('minimal');
  const [hint, setHint] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setDetail(notificationDetail());
    void isPushEnabled().then(setEnabled);
  }, []);

  if (!pushSupported()) return null;

  const toggle = async (): Promise<void> => {
    setBusy(true);
    setHint(null);
    try {
      if (enabled) {
        await disablePush();
        setEnabled(false);
        return;
      }
      const result = await enablePush();
      if (result.ok) setEnabled(true);
      else setHint(result.hint ?? 'Couldn’t enable notifications.');
    } finally {
      setBusy(false);
    }
  };

  const onDetail = (next: NotificationDetail): void => {
    setNotificationDetail(next);
    setDetail(next);
  };

  return (
    <div className={s.push}>
      <button
        type="button"
        className={s.pushToggle}
        onClick={() => void toggle()}
        disabled={busy}
        aria-pressed={enabled}
      >
        {enabled ? 'Notifications on' : 'Notify this phone'}
      </button>
      {enabled ? (
        <label className={s.pushDetail}>
          <input
            type="checkbox"
            checked={detail === 'full'}
            onChange={(e) => onDetail(e.target.checked ? 'full' : 'minimal')}
          />
          Show session names on the lock screen
        </label>
      ) : null}
      {hint ? (
        <p className={s.emptyHint} role="status">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
