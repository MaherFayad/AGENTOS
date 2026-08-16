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
import { useT } from '@/i18n';
import { relayToken, setRelayToken } from '../relay/client';
import s from '../sessions.module.css';

/** The CLI command the secret comes from. A command name, not copy — it is the
 *  same nine characters in every language, so it is interpolated rather than
 *  translated (§1.4). */
const HAPPY_AUTH = 'happy auth';

export function KeyGate({
  onUnlock,
  error,
}: {
  onUnlock: (secret: string) => void | Promise<void>;
  error: string | null;
}): React.JSX.Element {
  const t = useT();
  const [secret, setSecret] = useState('');
  const [token, setToken] = useState('');
  const alreadyPaired = Boolean(relayToken());

  return (
    <div className={s.tab}>
      <form
        className={s.gate}
        onSubmit={(e) => {
          e.preventDefault();
          if (token.trim()) setRelayToken(token.trim());
          void onUnlock(secret);
          setSecret('');
          setToken('');
        }}
      >
        <h1 className={s.gateTitle}>{t('sessions.gate.title')}</h1>
        <p className={s.gateBody}>{t('sessions.gate.body', { command: HAPPY_AUTH })}</p>
        <input
          className={s.gateInput}
          type="password"
          value={secret}
          onChange={(e) => setSecret(e.target.value)}
          placeholder={t('sessions.gate.secret')}
          autoComplete="off"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          aria-label={t('sessions.gate.secret')}
        />
        {alreadyPaired ? null : (
          <input
            className={s.gateInput}
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder={t('sessions.gate.tokenHint')}
            autoComplete="off"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            aria-label={t('sessions.gate.token')}
          />
        )}
        <button type="submit" className={`${s.pill} ${s.pillSecondary}`} disabled={!secret.trim()}>
          {t('sessions.gate.unlock')}
        </button>
        {error ? (
          <p className={s.error} role="alert">
            {error}
          </p>
        ) : null}
        <p className={s.gateNote}>{t('sessions.gate.note')}</p>
      </form>
    </div>
  );
}
