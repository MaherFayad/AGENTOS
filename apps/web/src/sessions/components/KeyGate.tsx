'use client';

/* =============================================================================
 * components/KeyGate.tsx — unlock this device (§3.1)
 *
 * This screen is the honest consequence of end-to-end encryption: a browser
 * that does not hold the key cannot show you anything, and no amount of server
 * cleverness can change that. So the copy says so plainly instead of showing a
 * spinner over an empty list.
 * ========================================================================== */

import { useState } from 'react';
import s from '../sessions.module.css';

export function KeyGate({
  onUnlock,
  error,
}: {
  onUnlock: (secret: string) => void | Promise<void>;
  error: string | null;
}): React.JSX.Element {
  const [secret, setSecret] = useState('');

  return (
    <div className={s.tab}>
      <form
        className={s.gate}
        onSubmit={(e) => {
          e.preventDefault();
          void onUnlock(secret);
          setSecret('');
        }}
      >
        <h1 className={s.gateTitle}>Unlock your sessions</h1>
        <p className={s.gateBody}>
          Transcripts are end-to-end encrypted. Paste the recovery secret from{' '}
          <code>happy auth</code> on the machine running Claude Code and this browser will
          decrypt them locally.
        </p>
        <input
          className={s.gateInput}
          type="password"
          value={secret}
          onChange={(e) => setSecret(e.target.value)}
          placeholder="recovery secret"
          autoComplete="off"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          aria-label="Recovery secret"
        />
        <button type="submit" className={`${s.pill} ${s.pillPrimary}`} disabled={!secret.trim()}>
          Unlock
        </button>
        {error ? (
          <p className={s.error} role="alert">
            {error}
          </p>
        ) : null}
        <p className={s.gateNote}>
          The key is derived here and stored in this browser only. It is never sent to the
          relay, never written to a log, and cannot be exported by any script on this page.
        </p>
      </form>
    </div>
  );
}
