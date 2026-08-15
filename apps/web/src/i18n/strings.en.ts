/* =============================================================================
 * i18n/strings.en.ts — the English catalogue. The source of truth for copy.
 *
 * Owner: rtl-arabic-pdpl-specialist · Spec §1.4, §2.0–2.6, §3.1–3.4.
 *
 * RULES FOR ADDING A KEY (all four, or the Arabic pass pays for it):
 *
 * 1. CASE IS NATURAL, NOT SHOUTED. The design is full of wide-tracked uppercase
 *    labels (§1.4) — those are produced by `text-transform: uppercase` in the
 *    `.u-label` class, not by typing 'ALL DEPARTMENTS' here. Arabic has no
 *    letter case, so `text-transform` is a no-op there and the same key works
 *    in both locales. A SHOUTED string in this file would arrive in Arabic as
 *    nothing at all.
 *
 * 2. ONE KEY = ONE COMPLETE SENTENCE OR ONE COMPLETE LABEL. Never two keys
 *    concatenated at the call site.
 *
 * 3. COUNTS USE PLURAL ENTRIES, never '{n} item(s)' and never a bare '{n} runs'.
 *
 * 4. NO IDIOM THAT ONLY WORKS IN ENGLISH. The voice is terse, confident, and
 *    contemptuous of manual work — that survives translation. "Piece of cake"
 *    does not.
 *
 * `[[double brackets]]` mark the accent phrase inside a headline. The renderer
 * turns them into the accent element: Instrument Serif italic in Latin,
 * weight contrast in Arabic (§1.4 — there is no italic in Arabic typography).
 * Translators move the brackets to whichever words carry the emphasis.
 * ============================================================================= */

import type { Plural } from './entry';

export const en = {
  /* ---------------------------------------------------------------------------
   * §2.0 App shell — identical on all four views.
   * ------------------------------------------------------------------------ */
  'shell.tab.map': 'Map',
  'shell.tab.dashboards': 'Dashboards',
  'shell.tab.chart': 'Chart',
  'shell.tab.sessions': 'Sessions',

  'shell.search.jobs': 'Search jobs',
  'shell.search.panels': 'Search panels',
  'shell.search.label': 'Search',

  'shell.eyebrow.navigation': 'Navigation',
  'shell.action.newSession': 'New session',
  'shell.action.fullscreen': 'Fullscreen',
  'shell.action.exitFullscreen': 'Exit fullscreen',
  'shell.action.help': 'Help',
  'shell.action.close': 'Close',
  'shell.action.back': 'Back',

  'shell.zoom.in': 'Zoom in',
  'shell.zoom.out': 'Zoom out',
  'shell.zoom.level': '{percent}%',

  /* Bottom-right pill: ours replaces their "Feedback" with connection state. */
  'shell.status.online': 'Tailnet online',
  'shell.status.offline': 'Tailnet unreachable',
  'shell.status.queue': {
    zero: 'Runner idle',
    one: '{count} run queued',
    other: '{count} runs queued',
  } satisfies Plural,
  'shell.cost.today': '{amount} today',

  /* Context breadcrumb strip (§2.0, appears in drill-ins). */
  'shell.breadcrumb.allDepartments': 'All departments',
  'shell.counter.live': '{live} of {total} live',
  'shell.counter.yourTree': 'Your tree',
  'shell.counter.yourTree.hint': 'Show only agents that are installed and live.',

  /* ---------------------------------------------------------------------------
   * §2.1–2.2 MAP — galaxy and department view.
   * ------------------------------------------------------------------------ */
  'map.department.previous': 'Previous department',
  'map.department.next': 'Next department',
  'map.node.state.live': 'Live',
  'map.node.state.draft': 'Draft',
  'map.node.state.failing': 'Failing',
  'map.node.state.dormant': 'Dormant',
  'map.node.state.scheduled': 'Scheduled',
  'map.node.state.awaitingApproval': 'Waiting for approval',
  'map.node.open': 'Open {name}',

  /* ---------------------------------------------------------------------------
   * §2.3 MAP job drawer + §2.6.5 chart drawer. Same vocabulary, two sides.
   * ------------------------------------------------------------------------ */
  'drawer.section.breaksInto': 'Breaks into',
  'drawer.section.wiredInto': 'Wired into',
  'drawer.section.buildsOn': 'Builds on',
  'drawer.section.replaces': 'What it replaces',
  'drawer.section.ladder': 'The ladder',
  'drawer.section.theHuman': 'The human',
  'drawer.section.lastRuns': 'Last runs',
  'drawer.section.inputs': 'Inputs',
  'drawer.section.skills': 'Skills',
  'drawer.section.tools': 'Tools',
  'drawer.section.whatItDoes': 'What it does',
  'drawer.section.howToRunIt': 'How to run it',
  'drawer.section.fromManualToAutonomous': 'From manual to autonomous',

  'drawer.skillFile.available': {
    one: '{count} runnable skill file · yours to download',
    other: '{count} runnable skill files · yours to download',
  } satisfies Plural,
  'drawer.action.take': 'Take it',
  'drawer.action.run': 'Run now',
  'drawer.action.schedule': 'Schedule',
  'drawer.action.read': 'Read',
  'drawer.action.download': 'Download',
  'drawer.action.moreDetail': 'More detail',
  'drawer.action.close': 'Close',
  'drawer.empty.loading': 'Loading this agent…',
  'drawer.empty.missing': 'This agent could not be loaded.',
  'drawer.ladder.now': 'Now',
  'drawer.console.title': 'Output',
  'drawer.console.running': 'Running',
  'drawer.console.finished': 'Finished in {duration}',
  'drawer.inputs.required': 'Required',
  'drawer.inputs.submit': 'Run with these inputs',

  /* Autonomy tiers — the frontmatter `tier` enum (Part IV). Used by the drawer
   * eyebrow, the ladder rows, the chart row headers and the chart legend. One
   * set of keys, because they are one set of words. */
  'tier.human-led': 'Human-led',
  'tier.assisted': 'Human-assisted',
  'tier.autonomous': 'Fully autonomous',
  'tier.human-led.blurb': 'A person drives it.',
  'tier.assisted.blurb': 'AI drafts, a human approves.',
  'tier.autonomous.blurb': 'AI runs it unattended.',

  /* Rollout phases — the frontmatter `phase` enum (§2.6 columns). */
  'phase.1-foundation': 'Foundation',
  'phase.2-capture': 'Capture',
  'phase.3-generate': 'Generate',
  'phase.4-orchestrate': 'Orchestrate',
  'phase.1-foundation.blurb': 'Data and the company brain',
  'phase.2-capture.blurb': 'Classify, extract, score',
  'phase.3-generate.blurb': 'Produce work, take action',
  'phase.4-orchestrate.blurb': 'Agents, monitoring, loops',

  /* ---------------------------------------------------------------------------
   * §2.4–2.5 DASHBOARDS.
   * ------------------------------------------------------------------------ */
  'dashboards.eyebrow': 'The output layer',
  'dashboards.title': 'Command Centers',
  'dashboards.subtitle': 'What each department looks like [[when the work runs itself]].',
  'dashboards.carousel.previous': 'Previous command center',
  'dashboards.carousel.next': 'Next command center',
  'dashboards.widget.updated': 'Updated {time}',
  'dashboards.widget.source.langfuse': 'From run traces',
  'dashboards.widget.source.sql': 'From agent output rows',

  /* ---------------------------------------------------------------------------
   * §2.6 CHART — the AI rollout matrix.
   * ------------------------------------------------------------------------ */
  'chart.title': '{department} · the AI rollout',
  'chart.stats': '{autonomous} of {total} jobs run autonomously, {assisted} are assisted, and the rest stay human.',
  'chart.row.jobCount': {
    zero: 'No jobs',
    one: '{count} job',
    other: '{count} jobs',
  } satisfies Plural,
  'chart.card.expand': 'Expand {name}',
  'chart.card.collapse': 'Collapse {name}',
  'chart.phaseTag': '{index} · {phase}',

  /* ---------------------------------------------------------------------------
   * §3.1 SESSIONS.
   * ------------------------------------------------------------------------ */
  'sessions.state.working': 'Working',
  'sessions.state.awaitingPermission': 'Waiting on permission',
  'sessions.state.idle': 'Idle',
  'sessions.permission.title': 'Permission needed',
  'sessions.permission.body': '{session} wants to use {tool}.',
  'sessions.permission.allow': 'Allow',
  'sessions.permission.deny': 'Deny',
  'sessions.compose.placeholder': 'Steer the session',
  'sessions.compose.send': 'Send',
  'sessions.meta.elapsed': 'Running for {duration}',

  /* ---------------------------------------------------------------------------
   * §3.2 Runs, schedules, approvals.
   * ------------------------------------------------------------------------ */
  'run.state.queued': 'Queued',
  'run.state.running': 'Running',
  'run.state.succeeded': 'Succeeded',
  'run.state.failed': 'Failed',
  'run.state.awaitingApproval': 'Waiting for your approval',
  'run.approval.approve': 'Approve',
  'run.approval.reject': 'Reject',
  'run.schedule.next': 'Next run {time}',
  'run.schedule.none': 'No schedule',
  'run.error.generic': 'The run stopped before it finished. The trace has the reason.',
  'run.error.offline': 'The runner is unreachable. Nothing was lost; try again when the tailnet is back.',

  /* ---------------------------------------------------------------------------
   * EMPTY STATES.
   *
   * Part VII.3: an honest empty state beats a plausible fake one. Every one of
   * these is a sentence a person wrote — it says what is true now and what the
   * one action is that changes it. None of them apologise, and none of them
   * say "No data available".
   * ------------------------------------------------------------------------ */
  'empty.library.title': 'The library is empty',
  'empty.library.body': 'Point the seeder at a repository. The galaxy draws itself from the frontmatter.',

  'empty.department.title': 'Nothing runs in this department yet',
  'empty.department.body': 'Every job here is still being done by hand. That is the backlog, and it is worth reading as one.',

  'empty.runs.title': 'This agent has never run',
  'empty.runs.body': 'The first run puts its cost, its duration and a link to its trace right here.',

  'empty.search.title': 'Nothing matches “{query}”',
  'empty.search.body': {
    zero: 'The library is empty, so nothing could have matched.',
    one: 'The library holds one agent and it does not answer to that.',
    other: 'The library holds {count} agents and none of them answer to that.',
  } satisfies Plural,

  'empty.panels.title': 'No command centers yet',
  'empty.panels.body': 'A dashboard is a JSON file in panels/. Write one and it appears in the carousel.',

  'empty.widget.title': 'No rows yet',
  'empty.widget.body': 'This widget draws what the agents write. It will not invent a number to fill the space.',

  'empty.chartCell.title': 'Nothing at this tier and phase',
  'empty.chartCell.body': 'An empty cell is a real answer: no job here has been mapped yet.',

  'empty.sessions.title': 'No sessions open',
  'empty.sessions.body': 'Start one here and it follows you to your phone, permission prompts and all.',

  'empty.audit.title': 'No audit has run',
  'empty.audit.body': 'The auditor walks the repository and the traces, then marks the map. It takes about a minute.',

  'empty.brain.title': 'The company brain is empty',
  'empty.brain.body': 'Run the interview. Twenty questions once is cheaper than explaining yourself to every agent forever.',

  'empty.inputs.title': 'This agent takes no inputs',
  'empty.inputs.body': 'Press run. It knows where to look.',

  /* ---------------------------------------------------------------------------
   * Accessibility labels. Never rendered, always translated — a screen reader
   * in Arabic reading an English label is the same bug as a visible one.
   * ------------------------------------------------------------------------ */
  'a11y.mapCanvas': 'Agent galaxy. Use the arrow keys to move between departments.',
  'a11y.drawer': 'Agent detail',
  'a11y.carousel': 'Command centers',
  'a11y.matrix': 'Rollout matrix: autonomy tier by rollout phase',
  'a11y.liveRegion.runStarted': 'Run started.',
  'a11y.liveRegion.runFinished': 'Run finished.',
} as const;

export type StringKey = keyof typeof en;
