'use client';

import { useEffect, useState } from 'react';
import type { Panel } from '@agnetos/contracts';
import { normalizePanelPayload } from '../data/normalize';
import { Carousel } from './Carousel';
import { EmptyLine } from './states';
import s from '../dashboards.module.css';

export function DashboardsView({
  panels,
  error,
}: {
  panels: readonly Panel[];
  error?: string;
}): React.JSX.Element {
  const [list, setList] = useState<readonly Panel[]>(panels);
  const [message, setMessage] = useState<string | undefined>(error);

  useEffect(() => {
    setList(panels);
    setMessage(error);
  }, [panels, error]);

  useEffect(() => {
    if (panels.length > 0) return;
    let cancelled = false;
    fetch('/api/panels', { headers: { accept: 'application/json' } })
      .then(async (res) => {
        if (!res.ok) throw new Error(String(res.status));
        return res.json();
      })
      .then((json) => {
        if (cancelled) return;
        const next = normalizePanelPayload(json);
        if (next.length) setList(next);
      })
      .catch(() => {
        if (!cancelled) {
          setMessage(
            error ??
              'No Command Centers to show. Add a panels/*.json file — the carousel is a projection of that folder.',
          );
        }
      });
    return () => {
      cancelled = true;
    };
  }, [panels, error]);

  if (list.length === 0) {
    return (
      <div className={s.view}>
        <div className="grid h-full place-items-center px-6">
          <EmptyLine>{message ?? 'No Command Centers yet. Add panels/*.json.'}</EmptyLine>
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
