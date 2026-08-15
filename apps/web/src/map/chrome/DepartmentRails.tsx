'use client';

import { findDepartment } from '@agnetos/contracts';
import { RailLabel } from '../../components/primitives';

/**
 * §2.2 — rotated rail labels for adjacent departments, with ‹ › to slide.
 * Neighbours come from ADR-001 (`packages/contracts` departments table), never a local list.
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
        className="pointer-events-auto absolute start-0 top-1/2 flex -translate-y-1/2 items-center gap-1 ps-3 text-ivory-2 transition-colors hover:text-ivory focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-4 focus-visible:outline-line-2"
      >
        <span aria-hidden="true">‹</span>
        <RailLabel serif>{prev.label}</RailLabel>
      </button>
      <button
        type="button"
        onClick={onNext}
        aria-label={`Slide to ${next.label}`}
        className="pointer-events-auto absolute end-0 top-1/2 flex -translate-y-1/2 items-center gap-1 pe-3 text-ivory-2 transition-colors hover:text-ivory focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-4 focus-visible:outline-line-2"
      >
        <RailLabel serif>{next.label}</RailLabel>
        <span aria-hidden="true">›</span>
      </button>
    </div>
  );
}
