/**
 * DASHBOARDS — public surface of `src/dashboards/**`.
 *
 * Owner: dashboards-engineer · Spec §2.4–2.5
 *
 * `loadPanels` is NOT exported here: it uses `node:fs` and must only be imported from
 * server components (`app/(views)/dashboards/**`).
 */

export { DashboardsView } from './components/DashboardsView';
export { DashboardDetail } from './components/DashboardDetail';
export { Carousel } from './components/Carousel';
export { WidgetView } from './components/WidgetView';
export { normalizePanelPayload, asPanel, sortPanels, toSummary } from './data/normalize';
export { buildPromptFor } from './lib/prompt';
