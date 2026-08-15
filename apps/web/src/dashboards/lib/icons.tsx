/**
 * Abstract monochrome marks — not vendor logos (ADR-004).
 *
 * Drawn from `currentColor` so they inherit ivory/ink and stay chrome. A trademarked
 * glyph would be both a licence problem (Part VII.2) and a colour problem (§1.3).
 *
 * Owner: dashboards-engineer · Spec §2.4 caption glyph, §2.5.1 title-row icon
 */

import { cx } from '@/components/primitives';

const svg = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true as const,
};

export function ProviderGlyph({
  provider,
  className,
  title,
}: {
  provider: string;
  className?: string;
  title?: string;
}): React.JSX.Element {
  const cls = cx('h-5 w-5 shrink-0 text-ivory-2', className);
  switch (provider) {
    case 'langfuse':
      return (
        <svg {...svg} className={cls}>
          {title ? <title>{title}</title> : null}
          <circle cx="12" cy="12" r="8" />
          <path d="M12 8v8M8 12h8" />
        </svg>
      );
    case 'postgres':
      return (
        <svg {...svg} className={cls}>
          {title ? <title>{title}</title> : null}
          <ellipse cx="12" cy="7" rx="7" ry="3" />
          <path d="M5 7v10c0 1.7 3.1 3 7 3s7-1.3 7-3V7" />
        </svg>
      );
    case 'amplitude':
      return (
        <svg {...svg} className={cls}>
          {title ? <title>{title}</title> : null}
          <path d="M4 18 L12 5 L20 18" />
          <path d="M7.5 14h9" />
        </svg>
      );
    default:
      return (
        <svg {...svg} className={cls}>
          {title ? <title>{title}</title> : null}
          <rect x="5" y="5" width="14" height="14" rx="3" />
        </svg>
      );
  }
}

/** KPI tile icons — 11px row, stroke only, currentColor. Unknown names degrade to a dot. */
export function KpiIcon({ name, className }: { name?: string; className?: string }): React.JSX.Element {
  const cls = cx('h-3 w-3 shrink-0', className);
  switch (name) {
    case 'wallet':
      return (
        <svg {...svg} className={cls}>
          <rect x="3" y="7" width="18" height="12" rx="2" />
          <path d="M3 10h18" />
        </svg>
      );
    case 'activity':
      return (
        <svg {...svg} className={cls}>
          <path d="M3 12h4l2-6 4 12 2-6h6" />
        </svg>
      );
    case 'timer':
    case 'clock':
      return (
        <svg {...svg} className={cls}>
          <circle cx="12" cy="12" r="8" />
          <path d="M12 8v5l3 2" />
        </svg>
      );
    case 'alert':
      return (
        <svg {...svg} className={cls}>
          <path d="M12 4 L21 19 H3 Z" />
          <path d="M12 10v4M12 16.5v.5" />
        </svg>
      );
    case 'layers':
      return (
        <svg {...svg} className={cls}>
          <path d="M12 4 L20 9 L12 14 L4 9 Z" />
          <path d="M4 13l8 5 8-5" />
        </svg>
      );
    case 'target':
      return (
        <svg {...svg} className={cls}>
          <circle cx="12" cy="12" r="8" />
          <circle cx="12" cy="12" r="4" />
          <circle cx="12" cy="12" r="1" />
        </svg>
      );
    case 'users':
      return (
        <svg {...svg} className={cls}>
          <circle cx="9" cy="9" r="3" />
          <path d="M4 18c0-2.5 2.2-4 5-4s5 1.5 5 4" />
          <circle cx="16" cy="9" r="2.5" />
        </svg>
      );
    default:
      return (
        <svg {...svg} className={cls}>
          <circle cx="12" cy="12" r="3" />
        </svg>
      );
  }
}
