import { cx } from '../ui';
import s from '../dashboards.module.css';

/** One honest line. Never a spinner that shifts layout (§2.5 rule 2). */
export function EmptyLine({ children }: { children: React.ReactNode }): React.JSX.Element {
  return <p className={cx(s.emptyLine, 'text-meta')}>{children}</p>;
}

/** Skeleton at a reserved height so the grid does not jump when data arrives. */
export function SkeletonBlock({ height }: { height: number }): React.JSX.Element {
  return (
    <span
      className={s.skeleton}
      style={{ height }}
      aria-hidden="true"
      data-testid="dash-skeleton"
    />
  );
}

export function UnsupportedWidget({ type }: { type: string }): React.JSX.Element {
  return (
    <div className={cx(s.unsupported, 'text-meta')} data-testid="dash-unsupported">
      Unsupported widget “{type}”. The seven canonical types are the ones this view
      renders — an eighth needs an ADR.
    </div>
  );
}
