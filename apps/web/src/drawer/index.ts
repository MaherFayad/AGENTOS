/**
 * Public surface of the job drawer (§2.3) and the chart-detail panel (§2.6.5).
 *
 * Anything not exported here is private and may change without a message.
 *
 * Owner: drawer-engineer
 */

export { JobDrawer, type DrawerSide, type JobDrawerProps } from './JobDrawer';
export { JobDrawerRoute } from './JobDrawerRoute';
export { DrawerHost } from './DrawerHost';
export { projectAgent, type DrawerModel } from './data/project';
export { planInputs } from './data/inputs';
