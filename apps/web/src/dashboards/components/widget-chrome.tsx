'use client';

import type { Format, PanelQuery, QueryStatus } from '@agnetos/contracts';
import { formatValue } from '../lib/format';
import { useResolved } from '../data/use-resolved';
import { Card, cx } from '../ui';
import { EmptyLine, SkeletonBlock, UnsupportedWidget } from './states';
import s from '../dashboards.module.css';

export function WidgetChrome({
  title,
  subtitle,
  span,
  children,
}: {
  title: string;
  subtitle?: string;
  span?: 1 | 2;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <Card radius="md" padded className={span === 2 ? s.span2 : undefined}>
      <header className="mb-3">
        <h3 className="text-small font-semibold text-ivory">{title}</h3>
        {subtitle ? <p className="mt-0.5 text-meta text-ink-2">{subtitle}</p> : null}
      </header>
      {children}
    </Card>
  );
}

export function QueryGate({
  query,
  emptyState,
  height,
  children,
}: {
  query: PanelQuery;
  emptyState?: string;
  height: number;
  children: (data: unknown) => React.ReactNode;
}): React.JSX.Element {
  const result = useResolved(query);
  if (result.loading) return <SkeletonBlock height={height} />;
  const empty = emptyCopy(result.status, result.message, emptyState);
  if (empty) return <EmptyLine>{empty}</EmptyLine>;
  if (result.data === undefined) return <EmptyLine>{emptyState ?? 'No data yet.'}</EmptyLine>;
  return <>{children(result.data)}</>;
}

export function emptyCopy(status: QueryStatus, message?: string, emptyState?: string): string | null {
  switch (status) {
    case 'ok':
      return null;
    case 'empty':
      // The source answered and had nothing. That is what `emptyState` is written for.
      return emptyState ?? 'Nothing in this window.';
    case 'unavailable':
      // The source could not answer at all, so the *reason* beats the panel's sentence:
      // "No spend in this window" is a claim about the data, and we do not have the data
      // to make it. A `sql` query carries no message precisely so its `emptyState` — which
      // names the agent that will fill it — still wins here.
      return message ?? emptyState ?? 'This number is not wired yet.';
    case 'error':
      return message ?? emptyState ?? 'Could not read this widget.';
    default: {
      const _never: never = status;
      return _never;
    }
  }
}

/**
 * The one place a dashboard prints a value, and the one place it admits it has none.
 *
 * THE EM-DASH IS NOT A SEPARATOR. Tokens contract §9.3 lists decorative glyphs (`·` `/`) as a
 * genuine `--ink-3` home and this looked like one — it is not. Here the `—` is the cell's
 * entire content, and under BOARD rule 9 it carries the difference between *"we measured
 * zero"* and *"we have no measurement"*. Delete it and the cell is blank, which reads as a
 * render that has not finished rather than a reading that does not exist. Required.
 *
 * It lands on `--ivory-2`, not `--ink-2`, for two independent reasons and either alone would
 * be enough:
 *  - §9.5 — `Formatted` renders inside `DataTable`'s peek rows, which hover to `--card-2`.
 *    Light `--ink-2` on `--card-2` is 4.25:1, sub-AA, precisely while the reader is pointing
 *    at the row. `--ivory-2` is 7.14:1 worst case.
 *  - §9.4a — the dash stands *in place of* a value that would have been `--ivory`, so one
 *    rung below is `--ivory-2`. §9.4b: raise the value, never lower the caveat.
 *
 * It also carries a real accessible name. `—` alone is announced as "dash", "em dash" or
 * silence depending on the AT and its punctuation setting, so the one cell whose whole job is
 * to say *no reading* was the one cell that said nothing.
 *
 * The value colour moved in here from the call sites. `cx('text-ink-3', 'text-ivory')` put two
 * `color` utilities on one span and let the Tailwind stylesheet's own ordering pick the
 * winner — the absent-reading colour was not actually decided by this branch at all.
 */
export function Formatted({
  value,
  format,
  className,
}: {
  value: unknown;
  format?: Format;
  className?: string;
}): React.JSX.Element {
  const text = format ? formatValue(value, format) : typeof value === 'number' ? String(value) : null;
  if (text === null) {
    return (
      <span className={cx('text-ivory-2', className)}>
        <span aria-hidden="true">—</span>
        <span className="sr-only">No reading</span>
      </span>
    );
  }
  return <span className={cx('tabular-nums text-ivory', className)}>{text}</span>;
}

export { UnsupportedWidget };
