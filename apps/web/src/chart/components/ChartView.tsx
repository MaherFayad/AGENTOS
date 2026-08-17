'use client';

import { useMemo, useState } from 'react';
import { DEPARTMENTS } from '../data/contracts';
import { agentsInDepartment } from '../data/agents';
import type { OpenDrawerHandler } from '../events';
import { buildMatrix } from '../model/matrix';
import { deriveStats } from '../model/stats';
import type { ChartAgent } from '../types';
import { ChartEmptyState } from './ChartEmptyState';
import { ChartStyles } from './ChartStyles';
import { DepartmentTabs, type DepartmentTab } from './DepartmentTabs';
import { Matrix } from './Matrix';
import { TitleBlock } from './TitleBlock';

export interface ChartViewProps {
  /** Every agent in the library, straight from the frontmatter projection. */
  agents: readonly ChartAgent[];
  /** Defaults to the ADR-001 department table. Injectable for tests only. */
  departments?: readonly DepartmentTab[];
  /** Controlled department slug; omit to let the view own the selection. */
  department?: string;
  defaultDepartment?: string;
  onDepartmentChange?: (slug: string) => void;
  /** Optional direct drawer handler; otherwise the §2.6.5 event is dispatched. */
  onOpenDrawer?: OpenDrawerHandler;
  /** Set when the library could not be loaded at all. */
  error?: string;
}

/**
 * §2.6 — CHART, the rollout planning board.
 *
 * Composition only: tabs, title block, matrix. Every number below is computed from the
 * `agents` prop, which is a projection of `agents/**` frontmatter — CHART holds no copy of
 * the library and no per-view agent metadata (§2.6 closing line, Part IV constraint 4).
 */
export function ChartView({
  agents,
  departments = DEPARTMENTS as readonly DepartmentTab[],
  department,
  defaultDepartment,
  onDepartmentChange,
  onOpenDrawer,
  error,
}: ChartViewProps) {
  const [uncontrolled, setUncontrolled] = useState(
    () => defaultDepartment ?? departments[0]?.slug ?? '',
  );
  const active = department ?? uncontrolled;

  const select = (slug: string) => {
    if (department === undefined) setUncontrolled(slug);
    onDepartmentChange?.(slug);
  };

  const activeLabel = departments.find((d) => d.slug === active)?.label ?? active;

  const counts = useMemo(() => {
    const tally: Record<string, number> = {};
    for (const agent of agents) tally[agent.department] = (tally[agent.department] ?? 0) + 1;
    return tally;
  }, [agents]);

  const inDepartment = useMemo(() => agentsInDepartment(agents, active), [agents, active]);
  const stats = useMemo(() => deriveStats(inDepartment), [inDepartment]);
  const matrix = useMemo(() => buildMatrix(inDepartment), [inDepartment]);

  return (
    <section className="mx-auto flex w-full max-w-[1240px] flex-col gap-5 px-6 py-6">
      <ChartStyles />
      {/* Counts are withheld when the library could not be read, and that is a correctness
          fix, not caution. A dimmed tab is a *claim* — "no jobs are mapped in this
          department" (REQ-CHT-05). Derived from a failed load it is seven false claims,
          made on the same screen that is simultaneously saying the library is unreadable.
          Unknown is not zero (Part VII.3, BOARD rule 9); with `counts` absent every tab
          renders at full weight and only the empty state speaks. */}
      <DepartmentTabs
        departments={departments}
        active={active}
        onSelect={select}
        counts={error ? undefined : counts}
      />

      <div id="chart-panel" role="tabpanel" aria-labelledby={`chart-tab-${active}`} className="flex flex-col gap-5">
        <TitleBlock departmentLabel={activeLabel} stats={stats} />

        {matrix.total === 0 ? (
          <ChartEmptyState departmentLabel={activeLabel} departmentSlug={active} error={error} />
        ) : (
          /* keyed by department: switching tabs resets focus and expansion, it does not
             carry one department's open card into another's board */
          <Matrix
            key={active}
            matrix={matrix}
            departmentLabel={activeLabel}
            onOpenDrawer={onOpenDrawer}
          />
        )}
      </div>
    </section>
  );
}
