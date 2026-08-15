import { icons } from 'lucide-react';

/**
 * The icon square on a job card (§2.6.4) and the tier row header glyph.
 *
 * `icon` is frontmatter and "must resolve in lucide-react"
 * (contracts/frontmatter-schema.md). An unresolvable name falls back to a neutral square
 * instead of throwing — a mistyped icon must not take the board down.
 *
 * Monochrome by rule: the glyph inherits `currentColor`. No icon in CHART carries a value,
 * so no icon in CHART carries a color (§1.3).
 */

const pascal = (name: string) =>
  name
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join('');

export function JobIcon({ name, size = 13 }: { name: string; size?: number }) {
  const Glyph = (icons as Record<string, typeof icons.Square | undefined>)[pascal(name)] ?? icons.Square;
  return <Glyph aria-hidden="true" size={size} strokeWidth={1.5} />;
}

/** The bordered square the glyph sits in — shared by job cards and tier row headers. */
export function IconSquare({ name, className = '' }: { name: string; className?: string }) {
  return (
    <span
      className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-[6px] border border-line bg-card text-ivory-2 ${className}`}
    >
      <JobIcon name={name} />
    </span>
  );
}
