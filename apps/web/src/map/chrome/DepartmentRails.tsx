'use client';

import { findDepartment } from '@agnetos/contracts';
import { RailLabel } from '../../components/primitives';

/**
 * §2.2 — rotated rail labels for adjacent departments, with ‹ › to slide.
 * Neighbours come from ADR-001 (`packages/contracts` departments table), never a local list.
 *
 * **`tone="muted"` is stated, not inherited** (tokens contract §9.2). It is now also the
 * primitive's default — the owner flipped it from `faint` on 2026-08-16 (§9.7) after this
 * exact site proved that a default prop is a token spent at a call site that never mentions
 * it, invisible to every grep including the token owner's. It stays written out because the
 * paragraphs below are a ruling about *these* rails, and a ruling with no visible subject is
 * one refactor away from being lost. These rails name the *neighbouring* departments and
 * appear nowhere else on screen, so §9.3's "a rail cap that repeats the heading beside it"
 * carve-out does not reach them: delete the text and the reader loses the only indication of
 * which departments are adjacent. Required reading.
 *
 * Why `--ink-2` and not `--ivory-2`, which is where the drawer and DASHBOARDS put prose on
 * interactive surfaces: that rule (§9.5) exists because `--card-2` is the standard hover fill
 * and drops `--ink-2` to 4.25:1 in light. These buttons have **no fill in either state** — they
 * float over the map's `--bg` → `--bg-3` vignette, where `--ink-2` measures 5.46:1 dark and
 * 5.06:1 light. The reason for `--ivory-2` is absent even though the "interactive" label fits,
 * and §9.4a wants the neighbours one rung below the department you are actually looking at.
 *
 * The rest→hover ramp carries the label the rest of the way. Before this, `hover:text-ivory`
 * on the button brightened only the aria-hidden chevron: `RailLabel` sets its own colour
 * class, so it never inherited the hover it was sitting inside. `group-hover`/
 * `group-focus-visible` reconnect it.
 */

export function DepartmentRails({
  department,
  onPrev,
  onNext,
}: {
  department: string;
  onPrev: () => void;
  onNext: () => void;
}): React.JSX.Element | null {
  const info = findDepartment(department);
  if (!info) return null;
  const prev = findDepartment(info.neighbours[0]);
  const next = findDepartment(info.neighbours[1]);
  if (!prev || !next) return null;

  return (
    <div data-testid="map-department-rails" className="pointer-events-none absolute inset-0 z-overlay">
      <button
        type="button"
        onClick={onPrev}
        aria-label={`Slide to ${prev.label}`}
        className="group pointer-events-auto absolute start-0 top-1/2 flex -translate-y-1/2 items-center gap-1 ps-3 text-ivory-2 transition-colors hover:text-ivory focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-4 focus-visible:outline-line-2"
      >
        <span aria-hidden="true">‹</span>
        <RailLabel
          serif
          tone="muted"
          className="transition-colors duration-hover ease-reveal group-hover:text-ivory group-focus-visible:text-ivory"
        >
          {prev.label}
        </RailLabel>
      </button>
      <button
        type="button"
        onClick={onNext}
        aria-label={`Slide to ${next.label}`}
        className="group pointer-events-auto absolute end-0 top-1/2 flex -translate-y-1/2 items-center gap-1 pe-3 text-ivory-2 transition-colors hover:text-ivory focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-4 focus-visible:outline-line-2"
      >
        <RailLabel
          serif
          tone="muted"
          className="transition-colors duration-hover ease-reveal group-hover:text-ivory group-focus-visible:text-ivory"
        >
          {next.label}
        </RailLabel>
        <span aria-hidden="true">›</span>
      </button>
    </div>
  );
}
