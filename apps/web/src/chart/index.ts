/**
 * CHART — the AI rollout matrix (§2.6). Public surface of `src/chart/**`.
 * Anything not exported here is private and may change without a message.
 */

export { ChartPage, type ChartPageProps } from './ChartPage';
export { ChartView, type ChartViewProps } from './components/ChartView';

// §2.6.5 — how CHART hands a selection to drawer-engineer's right drawer.
export {
  openDrawer,
  OPEN_DRAWER_EVENT,
  type OpenDrawerDetail,
  type OpenDrawerEvent,
  type OpenDrawerHandler,
  type DrawerSide,
} from './events';

// The frontmatter projection CHART consumes, for whoever feeds it agents.
export { loadChartAgents, toChartAgent, type AgentRecord, type LoadResult } from './data/agents';
export type { ChartAgent, ChartStats, ChartMatrix, ChartCell } from './types';

// The §2.6 axes, in case MAP or DASHBOARDS want the same labels for tier/phase.
export { TIER_ROWS, PHASE_COLUMNS, type TierRow, type PhaseColumn } from './model/taxonomy';
export { buildMatrix } from './model/matrix';
export { deriveStats, statLineText } from './model/stats';
