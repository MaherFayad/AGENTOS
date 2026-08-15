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
      return emptyState ?? 'Nothing in this window.';
    case 'unavailable':
      return emptyState ?? message ?? 'This number is not wired yet.';
    case 'error':
      return message ?? emptyState ?? 'Could not read this widget.';
    default: {
      const _never: never = status;
      return _never;
    }
  }
}

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
  if (text === null) return <span className={cx('text-ink-3', className)}>—</span>;
  return <span className={cx('tabular-nums', className)}>{text}</span>;
}

export { UnsupportedWidget };
