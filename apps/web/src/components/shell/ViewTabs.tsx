'use client';

import { useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { SegmentedControl } from './ui';
import { VIEWS, VIEW_LABELS, viewHref, type ShellView } from './route';
import { useShell } from './ShellContext';

/**
 * §2.0 top-center: the segmented control. Three tabs are theirs (MAP · DASHBOARDS ·
 * CHART); `SESSIONS` is our fourth (§3.1) and §2.0 is explicit that adding it must not
 * disturb the layout — which is why the top bar is a
 * `grid-cols-[1fr_auto_1fr]` and this control is the `auto` column. It stays optically
 * centred no matter how wide the search pill or the right-hand cluster get.
 *
 * The visual grammar (ivory pill for active, `--ink-2` for inactive, 11px uppercase
 * +0.25em) belongs to `SegmentedControl` — the shell only supplies items and routing.
 */
export function ViewTabs(): React.JSX.Element {
  const router = useRouter();
  const { route } = useShell();

  const onChange = useCallback(
    (value: string) => {
      router.push(viewHref(value as ShellView));
    },
    [router],
  );

  return (
    <SegmentedControl
      label="Views"
      value={route.view}
      onChange={onChange}
      items={VIEWS.map((view) => ({ value: view, label: VIEW_LABELS[view] }))}
    />
  );
}
