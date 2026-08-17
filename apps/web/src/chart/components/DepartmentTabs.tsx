'use client';

/**
 * §2.6.1 — the department tab bar, active tab marked with an ivory underline.
 *
 * The tabs and their ORDER come from `packages/contracts` (ADR-001) via
 * `ChartView`; this component never contains a department name. It takes the list as a
 * prop precisely so that hardcoding one is impossible here.
 *
 * **Arrow keys follow reading order** (`MIRRORS['shell.segmentedControl']` — *"tab order is
 * reading order"*). The bar is a flex row, so `dir="rtl"` reverses it; the handler reverses
 * with it via `inlineStep`, whose header carries the full account of why it exists and of
 * the one place in CHART it must not be applied.
 */

import { elementDirection, inlineStep } from '../model/direction';

export interface DepartmentTab {
  slug: string;
  label: string;
}

export interface DepartmentTabsProps {
  departments: readonly DepartmentTab[];
  active: string;
  onSelect: (slug: string) => void;
  /**
   * Jobs per department slug — a department with none is dimmed, never hidden or reordered
   * (REQ-CHT-05): the rollout gap is the information.
   *
   * **Absent means unknown, and unknown is not zero.** `ChartView` withholds it when the
   * library could not be read, because dimming is a claim about the library and a failed
   * load has nothing to claim with.
   */
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
        const delta = inlineStep(event.key, elementDirection(event.currentTarget));
        if (delta === 0) return;
        step(delta);
        event.preventDefault();
      }}
      /* `overflow-x-auto`, not `flex-wrap`: at 1440px the seven tabs are one row, which is
         the frame Part VI is judged against, and a bar that wraps would put the active
         underline above the rule instead of on it. Narrower than the bar it scrolls, and
         no tab is dropped or truncated — roving focus calls `.focus()`, which brings the
         tab into view, so the keyboard reaches all seven at any width. What is still
         missing is the *affordance* that the bar continues; that is filed, see
         comms/specs/chart-matrix.md REQ-CHT-49 and its Deliberately-not-done entry. */
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
            className={`relative -mb-px shrink-0 whitespace-nowrap pb-3 pt-1 text-label uppercase tracking-wider-2 outline-none transition-colors focus-visible:text-ivory ${
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
