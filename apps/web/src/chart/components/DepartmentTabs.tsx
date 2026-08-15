'use client';

/**
 * §2.6.1 — the department tab bar, active tab marked with an ivory underline.
 *
 * The tabs and their ORDER come from `packages/contracts` (ADR-001) via
 * `ChartView`; this component never contains a department name. It takes the list as a
 * prop precisely so that hardcoding one is impossible here.
 */

export interface DepartmentTab {
  slug: string;
  label: string;
}

export interface DepartmentTabsProps {
  departments: readonly DepartmentTab[];
  active: string;
  onSelect: (slug: string) => void;
  /** Jobs per department slug — a department with none is dimmed, not hidden. */
  counts?: Readonly<Record<string, number>>;
}

export function DepartmentTabs({ departments, active, onSelect, counts }: DepartmentTabsProps) {
  const step = (delta: number) => {
    const i = departments.findIndex((d) => d.slug === active);
    const next = departments[Math.min(departments.length - 1, Math.max(0, i + delta))];
    if (next && next.slug !== active) {
      onSelect(next.slug);
      document.getElementById(`chart-tab-${next.slug}`)?.focus();
    }
  };

  return (
    <div
      role="tablist"
      aria-label="Departments"
      data-testid="chart-department-tabs"
      onKeyDown={(event) => {
        if (event.key === 'ArrowRight') step(1);
        else if (event.key === 'ArrowLeft') step(-1);
        else return;
        event.preventDefault();
      }}
      className="flex items-end gap-6 overflow-x-auto border-b border-line"
    >
      {departments.map((department) => {
        const isActive = department.slug === active;
        const staffed = counts ? (counts[department.slug] ?? 0) > 0 : true;
        return (
          <button
            key={department.slug}
            type="button"
            role="tab"
            id={`chart-tab-${department.slug}`}
            aria-selected={isActive}
            aria-controls="chart-panel"
            tabIndex={isActive ? 0 : -1}
            data-active={isActive}
            onClick={() => onSelect(department.slug)}
            className={`relative -mb-px shrink-0 whitespace-nowrap pb-3 pt-1 text-[11px] font-medium uppercase tracking-[.3em] outline-none transition-colors focus-visible:text-ivory ${
              isActive ? 'text-ivory' : staffed ? 'text-ink-2 hover:text-ivory-2' : 'text-ink-3 hover:text-ink-2'
            }`}
          >
            {department.label}
            {isActive && (
              <span
                aria-hidden="true"
                data-testid="chart-tab-underline"
                className="absolute inset-x-0 -bottom-px block h-px bg-ivory"
              />
            )}
          </button>
        );
      })}
    </div>
  );
}
