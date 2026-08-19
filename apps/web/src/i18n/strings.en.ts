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
  /* The fourth tab. SESSIONS until M16; THREADS since (`Plan §23.8`). §3.1's own copy
     below is unchanged — /sessions is still a live path under this tab. */
  'shell.tab.threads': 'Threads',

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

  /* §2.0 cost ticker — the five readings and the three ways there is no reading.
   * Filed by `shell-navigation-engineer` 2026-08-16 with the proposed key names
   * kept verbatim, because a key rename during a handoff is a merge conflict
   * nobody learns anything from. The pill labels are lower case: the caps come
   * from `text-transform`, which does nothing in Arabic (rule 1 above).
   *
   * `shell.cost.outage` and `shell.cost.noLedger` are NOT fallbacks in Arabic.
   * The runner ships an English `ledger.hint` carrying a live retry count, and
   * under a non-English locale the catalogue sentence wins over it — see
   * i18n/server-copy.ts. Both are therefore written to stand alone. */
  'shell.cost.state.unpriced': 'not priced',
  'shell.cost.state.outage': 'spend unknown',
  'shell.cost.state.noLedger': 'no ledger',
  'shell.cost.state.unavailable': 'no cost data',
  'shell.cost.loading': 'Checking today’s agent spend.',
  'shell.cost.amount': 'Agent spend so far today: {amount}.',
  'shell.cost.zero':
    'No agent run has been recorded today, so nothing has been spent. The run ledger is connected, so this zero is a reading rather than a guess.',
  'shell.cost.unpriced':
    'Runs were recorded today but none of them carries a price yet, so today’s spend is not known. This is not zero.',
  'shell.cost.outage':
    'The run ledger is not answering, so today’s spend is unknown — not zero. Runs still work and will be recorded once the database is back.',
  'shell.cost.noLedger':
    'This runner has no run ledger configured, so there is no spend to read. That is normal on the dev profile, not a fault.',
  'shell.cost.notBuilt':
    'Langfuse isn’t reporting spend yet, so there is no number to show here. This fills in the first time an agent run is traced.',
  'shell.cost.malformed':
    'Today’s spend came back in a shape this build does not understand — without it, a real zero and a ledger outage look identical, so no number is shown. That is a bug here, not a fact about your spend.',
  'shell.cost.offline': 'Couldn’t reach Langfuse for today’s spend. This box may be off the tailnet.',

  /* The same shape on the other three polled endpoints. A body this build cannot
   * read is its own sentence — it is not "nothing happened yet". */
  'shell.status.malformed':
    'The runner answered with something this build does not understand, so its state is unknown rather than offline.',
  'shell.search.graph.malformed':
    'The agent index came back in a shape this build does not understand, so search is empty rather than wrong.',
  'shell.search.panels.malformed':
    'The dashboard index came back in a shape this build does not understand, so search is empty rather than wrong.',

  /* `Plan §23.10` project switcher — the shell's highest-frequency new control.
   *
   * Written as whole sentences rather than as the fragments the component was
   * assembling, and the reason is the M15 verdict rather than a preference: the
   * accessible name was
   *   `Project: ${slug}. ${confirmed ? 'Confirmed…' : 'Not confirmed…'} Change project.`
   * which is three clauses glued at the call site (rule 2), and a template literal
   * is invisible to the copy scan besides. Two keys, one per state, so a
   * translator moves "Change project" wherever their grammar wants it and the
   * confirmation clause inflects with the rest of the sentence.
   *
   * `shell.project.none` is lower case on purpose — it sits in the pill under
   * `text-transform: uppercase`, which does nothing in Arabic (rule 1).
   *
   * Key names are `shell-navigation-engineer`'s from their 2026-08-17T00:41 filing,
   * kept verbatim, because a rename during a handoff is a merge conflict nobody
   * learns anything from. The ONE place I departed from their list is the
   * accessible name: they proposed `.label` · `.change` · `.confirmed` ·
   * `.unconfirmed` as four keys, and the component was gluing them at the call
   * site. That is rule 2, and it is what the verdict caught. `.aria.confirmed` and
   * `.aria.unconfirmed` say the whole thing twice instead. `.title` is new — the
   * tooltip was a template literal and had no proposed key at all. */
  'shell.project.none': 'no project',
  'shell.project.list': 'Projects',
  'shell.project.mounted': 'mounted',
  'shell.project.elsewhere': 'elsewhere',
  'shell.project.title': 'Project {project}. Everything on screen is scoped to it.',
  'shell.project.aria.confirmed': 'Project: {project}. Confirmed by the runner. Change project.',
  'shell.project.aria.unconfirmed':
    'Project: {project}. Not confirmed by the runner. Change project.',
  'shell.project.empty':
    'The runner listed no projects. Nothing here is a guess — the switcher shows what it was told.',
  'shell.project.onlyOne':
    'One project is mounted. Switching has nothing to switch to yet, so nothing here shows that project scoping works — only that it exists.',
  'shell.project.isolationOff':
    'The runner reports that its database connection bypasses row-level security, so project isolation is not being enforced underneath these names.',
  'shell.project.isolationUnknown': 'The runner did not say whether project isolation is enforced.',

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

  /* The galaxy chrome. `map.empty.body` is the fallback under `map.empty.title`
   * when the runner sends no sentence of its own; when it does send one, §1.4's
   * server-copy rule decides which wins (see i18n/server-copy.ts). */
  'map.empty.title': 'The galaxy is not built yet',
  'map.empty.notBuilt':
    'The map layout has not been built yet. Run {command} — until then the galaxy is empty on purpose.',
  'map.empty.malformed': 'The map layout is not a graph payload, so nothing is drawn.',
  'map.empty.offline': 'Can’t reach the runner, so there is no map to draw.',
  'map.focus.previous': 'Focus previous department',
  'map.focus.next': 'Focus next department',

  /* §3.3 the Second Brain at zero — the honest empty state at the galaxy's centre.
   * Each is a whole sentence: the aria label is NOT the eyebrow plus the count
   * plus the hint glued together, because that glue does not survive a language
   * whose clause order is different. */
  'map.brain.eyebrow': 'Second brain',
  'map.brain.count': {
    one: '{answered} of {total} question answered',
    other: '{answered} of {total} questions answered',
  } satisfies Plural,
  'map.brain.noCount': 'No interview answers yet',
  'map.brain.hint': 'Run the company interview — the galaxy fills as answers land',
  'map.brain.aria': {
    one: 'Second brain, {answered} of {total} question answered. Run the company interview to fill the galaxy.',
    other: 'Second brain, {answered} of {total} questions answered. Run the company interview to fill the galaxy.',
  } satisfies Plural,
  'map.brain.aria.noCount':
    'Second brain, no interview answers yet. Run the company interview to fill the galaxy.',

  /* The node label a screen reader hears (§2.1). Separate keys from
   * `map.node.state.*` on purpose: a chip is a label and this is a phrase in a
   * spoken list, and the two registers differ in Arabic more than in English.
   * They are joined by Intl.ListFormat, never by ', ' — the Arabic separator is
   * '، ' and hardcoding a comma is the same class of mistake as hardcoding a
   * left margin. */
  'map.node.aria.branch': 'department branch',
  'map.node.aria.live': 'live',
  'map.node.aria.failing': 'failing its audit',
  'map.node.aria.dormant': 'dormant, not yet live',
  'map.node.aria.scheduled': 'scheduled',
  'map.node.aria.awaitingApproval': 'waiting for approval',
  'a11y.galaxyGroup': 'Agent galaxy',

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

  /* Provenance the drawer does not have (`Plan §23.6`, ADR-014).
   *
   * The five states of `provenance.badge.*` are answers; this is the admission
   * that there is no answer yet, and it is a separate key rather than a sixth
   * state because `unknown` is not a layer. Kept short — it sits beside an
   * already-tracked eyebrow — with the reason carried by the a11y sentence,
   * where length is free. */
  'drawer.provenance.unknown': 'Source unknown',
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
   * THREADS — the fourth tab (`Plan §23.5`, `Plan §23.8`). The three
   * `threads.mount.*` scaffold keys were deleted with `ThreadsMount.tsx`; this is
   * the real view's copy.
   *
   * NOTHING HERE MAY HOLD A CURRENCY FIGURE, and `i18n.test.ts` fails on one
   * appearing under `threads.`. `Plan §23.8` asks the composer for
   * `@@sales · 4 runs · ~$0.40`; the `4` is the resolved member count and the
   * `$0.40` has no source, because zero runs have ever completed and there is
   * nothing to average. See the register block further down for the full note —
   * the same rule governs both halves of this feature.
   *
   * The fan-out confirm is the one screen in this product that asks a person to
   * authorise N runs instead of one, so its copy states **two** facts and never
   * one: how many runs the address means, and that none of them will start
   * today. Either alone misleads, in opposite directions.
   * ------------------------------------------------------------------------ */
  'threads.eyebrow': 'Threads',
  'threads.billing':
    'A session is billed to your Claude subscription. An agent thread’s runs are billed to the runner’s capped workspace. Two different pots.',

  'threads.group.agent': 'Agent threads',
  'threads.agent.unreadableTitle': 'Not readable in this build',
  /* Deliberately NOT "no threads yet". Both halves are named because fixing
   * either one alone leaves this list empty, and the next reader would then be
   * told a new story about the same blank space. */
  'threads.agent.unreadable':
    'Two things are missing, not one: the runner serves no route that lists threads, and the table they would come from has never met a running database. This is an absence of a reading, not a count of zero.',

  'threads.compose.label': 'New thread',
  'threads.compose.placeholder': '@sales/account-enrichment, #sales, @@sales — or just type',
  'threads.compose.send': 'Send',
  /* `@@` never sends on submit; the button opens the confirm instead, and says so. */
  'threads.compose.review': 'Review fan-out',
  'threads.compose.levelLabel': 'How this message lands',
  'threads.compose.unknownDepartment':
    'This project’s map has no department called {name}. Sending anyway is allowed — the runner resolves addresses, and this list can be stale.',
  'threads.compose.noProject':
    'This address does not name a project, and a thread belongs to one. Open it from the project switcher and this sends.',
  'threads.compose.offline': 'Can’t reach the runner, so nothing was sent. This box may be off the tailnet.',
  'threads.compose.refusedFallback': 'The runner refused this and did not say why.',
  'threads.compose.malformed':
    'The thread was created and the answer came back in a shape this build doesn’t understand, so there is nowhere to send you. That is a bug here.',

  'threads.fanout.eyebrow': 'Confirm fan-out',
  'threads.fanout.count': {
    one: 'This addresses {name}, which has {count} member. That is {count} run, one each.',
    other: 'This addresses {name}, which has {count} members. That is {count} runs, one each.',
  } satisfies Plural,
  /* No numeral at all. A count nobody took is not a zero, and this is the one
   * screen where a plausible number would be acted on. */
  'threads.fanout.countUnknown':
    'This addresses every member of {name} and starts one run for each. How many members that is has not been counted here, so no number is shown.',
  'threads.fanout.refused':
    'No run starts today: fan-out dispatch is held until the spend cap has proven it can refuse something, and it has never once fired. The thread is still opened, and the refusal travels with it. Unblocked by: {unblockedBy}.',
  'threads.fanout.cancel': 'Cancel',
  'threads.fanout.open': 'Open the thread',

  'threads.one.eyebrow': 'Thread',
  'threads.one.loading': 'Reading the thread…',
  'threads.one.unavailableTitle': 'Nothing to show',
  'threads.one.notFound':
    'There is no thread with this id in this project. A thread id from another project reads the same way, on purpose.',
  'threads.one.malformed':
    'The thread came back in a shape this build doesn’t understand. The runner and this app are out of step — that is a bug here, not a missing thread.',
  'threads.one.offline': 'Can’t reach the runner, so this thread can’t be read. This box may be off the tailnet.',
  'threads.one.noProject':
    'This address does not name a project, and every thread belongs to one. Open it from the project switcher.',
  'threads.one.emptyTitle': 'No turns yet',
  'threads.one.empty': 'This thread exists and nothing has been said in it.',
  'threads.one.inMailbox': 'still in the mailbox',

  'threads.state.open': 'Open',
  'threads.state.running': 'Running',
  'threads.state.waiting': 'Waiting on you',
  'threads.state.closed': 'Closed',
  'threads.state.failed': 'Failed',

  'threads.kind.human': 'You',
  'threads.kind.agent': 'Agent',
  'threads.kind.question': 'Question',
  'threads.kind.answer': 'Answer',
  'threads.kind.system': 'System',

  /* ---------------------------------------------------------------------------
   * §3.1 SESSIONS — now the *session group* inside the THREADS view, not a view
   * of its own. `/sessions` redirects to `/threads`; `/sessions/:id` stays.
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

  /* The list tab. `sessions.eyebrow` is natural case on purpose — the caps are
   * `text-transform` on `.u-eyebrow` (rule 1 above), and Arabic has no case. */
  'sessions.eyebrow': 'Sessions',
  'sessions.waiting': {
    one: '{count} waiting on you',
    other: '{count} waiting on you',
  } satisfies Plural,
  'sessions.billing': 'Billed to your Claude subscription, not the runner’s monthly cap.',
  'sessions.list.loading': 'Reading the relay…',
  'sessions.list.undecryptable': {
    one: 'One session on the relay could not be decrypted with this device’s key.',
    other: '{count} sessions on the relay could not be decrypted with this device’s key.',
  } satisfies Plural,

  /* One session, full screen. */
  'sessions.view.back': 'Sessions',
  'sessions.view.title': 'Session',
  'sessions.view.meta': '{id} · billed to your Claude subscription',
  'sessions.connection.connecting': 'Connecting to the session…',
  'sessions.connection.reconnecting': 'Reconnecting. You are seeing everything up to the drop.',
  'sessions.connection.offline': 'Offline. This is the transcript as of the last connection.',
  'sessions.transcript.label': 'Session transcript',
  'sessions.transcript.gap': 'Some lines were missed while this device was offline. The relay’s replay buffer had already rolled past them.',
  'sessions.transcript.permission': 'Permission · {tool} · {summary}',
  'sessions.compose.label': 'Message this session',
  'sessions.permission.eyebrow': 'Waiting on you',

  /* Push (§3.6 seam). The ask happens on a tap, never on mount. */
  'sessions.push.enable': 'Notify this phone',
  'sessions.push.enabled': 'Notifications on',
  'sessions.push.names': 'Show session names on the lock screen',
  'sessions.push.failed': 'Notifications could not be turned on.',

  /* The key gate — the honest consequence of end-to-end encryption (§3.1). */
  'sessions.gate.title': 'Unlock your sessions',
  'sessions.gate.body': 'Transcripts are end-to-end encrypted. Paste the recovery secret that {command} prints on the machine running Claude Code, and this browser decrypts them locally.',
  'sessions.gate.secret': 'Recovery secret',
  'sessions.gate.token': 'Relay pairing token',
  'sessions.gate.tokenHint': 'Relay token, optional for now',
  'sessions.gate.unlock': 'Unlock',
  'sessions.gate.note': 'The key is derived here and stored in this browser only. It is never sent to the relay, never written to a log, and cannot be exported by any script on this page.',

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

  'empty.sessions.title': 'Nothing is running',
  'empty.sessions.body': 'Start a Claude Code session on any machine paired with this relay and it appears here, with its transcript and a button to answer its permission prompts from wherever you are.',

  'empty.relay.title': 'No answer from the relay',
  'empty.relay.body': 'Nothing is lost. The sessions are still on their machines, and this list fills in the moment the relay answers.',

  'empty.transcript.title': 'Nothing yet',
  'empty.transcript.body': 'This session has not said anything since it started. Type below to steer it.',

  'empty.audit.title': 'No audit has run',
  'empty.audit.body': 'The auditor walks the repository and the traces, then marks the map. It takes about a minute.',

  'empty.brain.title': 'The company brain is empty',
  'empty.brain.body': 'Run the interview. Twenty questions once is cheaper than explaining yourself to every agent forever.',

  'empty.inputs.title': 'This agent takes no inputs',
  'empty.inputs.body': 'Press run. It knows where to look.',

  /* ---------------------------------------------------------------------------
   * Plan §10 — provenance. Which library the agent in front of you came from.
   *
   * One key per state, never two concatenated (rule 2): the severity word leads,
   * so "Drifted fork a1b2c3" survives truncation with the important half intact
   * and a translator can put the commit wherever their grammar wants it.
   * `{commit}` is a short git SHA and renders uppercase with the rest of the
   * label — hex is case-insensitive, and one casing across the badge is worth
   * more than matching `git log`.
   * ------------------------------------------------------------------------ */
  'provenance.badge.global': 'Global',
  'provenance.badge.project': 'Project',
  'provenance.badge.fork': 'Fork {commit}',
  'provenance.badge.drifted': 'Drifted fork {commit}',
  'provenance.badge.orphaned': 'Orphaned fork {commit}',

  /* ---------------------------------------------------------------------------
   * Accessibility labels. Never rendered, always translated — a screen reader
   * in Arabic reading an English label is the same bug as a visible one.
   * ------------------------------------------------------------------------ */
  'a11y.provenance.global': 'Resolved from the global library.',
  'a11y.provenance.project': "Resolved from this project's library.",
  'a11y.provenance.fork': 'Forked from {parent} at {commit}, and it still matches its parent.',
  'a11y.provenance.drifted': 'Forked from {parent} at {commit}. The parent has changed since.',
  'a11y.provenance.orphaned': 'Forked from {parent} at {commit}. The parent no longer exists.',
  'a11y.provenance.unknown':
    'Which library this agent came from is not known. The agent detail did not say, ' +
    'and no run of this agent has said either.',

  /* ---------------------------------------------------------------------------
   * Plan §12 — threads. Two registers: who a turn goes to, and how disruptively
   * a message lands. Both are chrome, so neither has a colour to lean on and the
   * words have to carry what the greys cannot.
   *
   * THE COUNT IS REAL AND THE MONEY IS NOT. `Plan §23.8` asks the composer to say
   * `@@sales · 4 runs · ~$0.40`. The 4 is the resolved member count. The $0.40 has
   * no source — zero runs have ever completed, so there is nothing to average —
   * and a cost preview is exactly where a plausible number gets believed
   * (BOARD rule 9). There is deliberately no key here that could hold one, and
   * `i18n.test.ts` fails on a currency symbol appearing under `threads.`.
   *
   * "AT LEAST" IS NOT HEDGING. `#sales` is a lower bound, not a total: the lead
   * answers *or delegates*, and a delegation is a second run
   * (`TurnCost.runsAreExact === false`). A flat "1 run" beside a mechanism that
   * routinely costs two is a plausible number one decimal place up.
   *
   * The level names lead their sentences and the sentences never name the level,
   * so a translator may choose the three terms of art without rewriting four
   * other keys around their choice.
   * ------------------------------------------------------------------------ */
  'threads.address.default': 'Chief of Staff',

  'threads.cost.runs': {
    zero: 'no runs',
    one: '{count} run',
    other: '{count} runs',
  } satisfies Plural,
  'threads.cost.runsAtLeast': {
    one: 'at least {count} run',
    other: 'at least {count} runs',
  } satisfies Plural,
  /* Not "0 runs". A count nobody took and a count that came back empty are two
   * different facts, and the badge draws them differently for the same reason. */
  'threads.cost.unresolved': 'Runs not counted yet',

  'threads.interrupt.note': 'Note',
  'threads.interrupt.steer': 'Steer',
  'threads.interrupt.halt': 'Halt',

  'a11y.threads.address.direct': 'Goes to {name}. One run, exactly.',
  'a11y.threads.address.dispatch':
    'Goes to the lead of {name}, which answers itself or delegates — so at least one run.',
  'a11y.threads.address.fanout':
    'Goes to every member of {name}, each answering independently. One run each.',
  /* Deliberately does NOT name the role. Like the three interrupt sentences below, it
   * describes what happens, so choosing the Arabic for "Chief of Staff" later does not
   * force a rewrite of the sentence around it. */
  'a11y.threads.address.default':
    'No address, so this goes to the project’s default recipient, which triages, answers or routes — at least one run.',

  'a11y.threads.interrupt.note':
    'This waits in the mailbox and is read at the next tool boundary. Nothing in flight is disturbed.',
  'a11y.threads.interrupt.steer':
    'This is injected into the running session now and changes its course mid-task.',
  'a11y.threads.interrupt.halt':
    'This stops the work, checkpoints what is done, and asks you before continuing.',
  /* THE REASON CHANGED, AND THE OLD ONE WAS THE WRONG REASON. This used to say
   * "nothing is running on this thread", which is thread-model §4.2's refusal — the
   * one that applies when there is no run in flight. The runner refuses EVERY steer,
   * in flight or not (`MID_RUN_STEER.supported` is false; `interrupt_not_deliverable`
   * 409), so the old sentence told a reader with a run in flight that the refusal did
   * not apply to them. A stated reason that is false is worse than no reason: it is
   * the house defect (a declared value read as an observed one) wearing a tenth
   * costume. This sentence is true in both cases. */
  'a11y.threads.interrupt.undeliverable':
    'Steering a run in progress is not available in this build, so this would be refused rather than queued.',

  /* ---------------------------------------------------------------------------
   * The mailbox composer in the drawer (`Plan §12` · `§23.12 P2`).
   * Owner of the surface: `drawer-engineer`. Written in Arabic, not `todo()`d —
   * `strings.ar.ts` states why, and `rtl-arabic-pdpl-specialist` may overwrite
   * all seventeen without asking.
   *
   * THERE IS NO KEY HERE FOR THE REFUSAL'S REASON, ON PURPOSE. The composer
   * renders `a11y.threads.interrupt.undeliverable` — the same sentence
   * `InterruptBadge` announces — rather than a composer-voice sibling. A second
   * sentence saying the same thing is a second sentence that can drift, and this
   * one has already been wrong once: it used to name thread-model §4.2's
   * condition (*"nothing is running on this thread"*) instead of the runner's,
   * which told a reader with a run in flight that the refusal did not apply to
   * them. One sentence, one place to correct it.
   *
   * NO KEY HERE CAN HOLD A FIGURE, for the same reason the register above has
   * none: `TurnCost.estimatedUsd` is typed `null` and zero runs have completed.
   *
   * DISPOSITION AND STATE ARE DIFFERENT FACTS AND GET DIFFERENT SENTENCES.
   * `queued` and `delivered-to-run` are what the runner says happened; the
   * thread state is what the runner read *before* writing. Blurring them is
   * exactly what invariant 7 forbids, one level down.
   * ------------------------------------------------------------------------ */
  'threads.mailbox.bodyLabel': 'Send into this thread',
  'threads.mailbox.bodyPlaceholder': 'What should the agent know?',
  'threads.mailbox.levelLabel': 'How it lands',
  'threads.mailbox.send': 'Send',
  'threads.mailbox.sending': 'Sending…',
  'threads.mailbox.emptyBody': 'A message needs a body. Nothing was sent.',
  /* The honest empty state for an address this build cannot know. `SseStartData`
   * carries no thread id, so a run on screen cannot say which conversation it is
   * a turn of. Named rather than hidden — a composer that silently disappears is
   * indistinguishable from one nobody built. */
  'threads.mailbox.noThread':
    'The run stream does not say which thread this run belongs to, so there is no mailbox to address from here yet.',

  'threads.mailbox.disposition.queued':
    'Queued in the mailbox. Nothing has read it yet — the thread’s next run does.',
  'threads.mailbox.disposition.deliveredToRun':
    'Handed to the run in flight, which reads it at its next settled tool call.',

  /* Five sentences rather than one with a `{state}` variable: a sentence
   * assembled at the call site from two catalogue keys is banned outright
   * (`i18n/entry.ts`), and a state name is a word that inflects. */
  'threads.mailbox.appendState.open': 'The thread was open when this was appended.',
  'threads.mailbox.appendState.running': 'The thread was running when this was appended.',
  'threads.mailbox.appendState.waiting': 'The thread was waiting on a question when this was appended.',
  'threads.mailbox.appendState.closed': 'The thread was closed when this was appended.',
  'threads.mailbox.appendState.failed': 'The thread had failed when this was appended.',
  'threads.mailbox.appendStateCaveat':
    'That is the state read before the message was written, not the state after it.',
  'threads.mailbox.haltNotYetMoved':
    'A halt does not move the thread by itself. The run’s next drain reads it, stops the session, and moves the thread then.',

  /* ---------------------------------------------------------------------------
   * M17 · `Plan §13` — work products, the diff review screen, and the verdict.
   *
   * The register of this block is set by one fact, and every sentence in it is
   * written for that fact rather than around it: **no agent run has ever executed
   * and no project has a checked-out repository**, so `ops.work_product` has never
   * held a row. The state a person will actually see is the empty one, so the
   * empty sentence is the one that got the most attention.
   *
   * The distinction the rest of the block exists for is the house defect landing
   * on the screen where it costs real work: a value that was **recorded** on a row
   * versus a value something **observed**. `work.recorded` and `work.recordedWhy`
   * are the qualifier, and they are attached at the point of display rather than
   * written into the value — `contracts/work-product.md` §0.
   * ------------------------------------------------------------------------ */
  'drawer.section.work': 'Work products',
  'work.scopeNote':
    'The newest work products in this project. The route carries no per-agent filter, so this list is not narrowed to this agent.',
  'work.filter.all': 'All',
  'work.filter.review': 'Awaiting review',
  'work.loading': 'Looking for work products…',
  'work.empty':
    'No run has left a work product behind. Nothing has executed and no project has a repository checked out, so this list is empty rather than filtered.',
  'work.emptyReview': 'Nothing is waiting for review.',
  'work.failed': 'Could not reach the runner, so this list is empty rather than wrong.',
  /* Reached, and answered with something that is not a list. Distinct from `work.failed` on
     purpose: "could not reach" and "answered wrongly" send a reader to different places, and
     a shape mismatch that renders as a network problem wastes the hour spent looking at the
     network. Nothing is invented to fill the gap. */
  'work.unreadable':
    'The runner answered, but not with a list of work products. Nothing is shown rather than something invented.',
  'work.commits': { one: '{count} commit', other: '{count} commits' },
  'work.files': { one: '{count} file', other: '{count} files' },
  'work.lines': '+{insertions} −{deletions}',
  'work.push.local': 'Unpushed',
  'work.push.pushed': 'Pushed',
  'work.push.none': 'Nothing to push',
  'work.push.unknown': 'Push state unknown',
  'work.push.observedAt': 'Looked at {time}.',
  'work.push.unknownWhy':
    'Nothing has ever looked at whether this branch left the machine. That is not the same as having nothing to push.',
  'work.pr': 'PR {number}',
  'work.pr.open': 'Pull request open',
  'work.pr.merged': 'Pull request merged',
  'work.pr.closed': 'Pull request closed',
  'work.pr.draft': 'Pull request in draft',
  'work.ci.pending': 'CI pending',
  'work.ci.passing': 'CI passing',
  'work.ci.failing': 'CI failing',
  'work.ci.unknown': 'CI state unknown',
  'work.tests': { one: '{passed} of {count} test passed', other: '{passed} of {count} tests passed' },
  'work.recorded': 'Recorded',
  'work.recordedWhy':
    'Nothing in this build opens a pull request, runs CI or runs a test suite. This value was written on the row; nothing here watched it happen.',
  'work.diffGone':
    'The worktree for this run has been removed, so its diff can no longer be read.',
  /* `Plan §13`'s fourth roster line. Its only representation is `done.threadState ===
     'waiting'` — a question is a message kind in a thread, not a second flag that could
     disagree with the row (§7). The roster route does not carry it, so a row read from
     there draws no cell rather than a confident "not blocked". */
  'work.blocked': 'Blocked — it asked you something',
  'work.review.open': 'Review this change',
  'work.thread.open': 'Open the conversation this run belongs to',

  'work.diff.title': 'Review',
  'work.diff.close': 'Close the review',
  'work.diff.tree': 'Tree {sha}',
  'work.diff.loading': 'Reading the diff…',
  'work.diff.empty': 'This run changed no files.',
  'work.diff.binary': 'Binary file. Flagged, never sent as bytes.',
  'work.diff.withheld': {
    one: '{count} further line in this file was not sent.',
    other: '{count} further lines in this file were not sent.',
  },
  'work.diff.more': 'Show more files',
  /* The model's hold ceiling (`MAX_DIFF_ROWS_HELD`). Reached only by loading page after
     page; the ceiling is far above one page on purpose. It says the number it is holding
     because a *Show more* that stops working without a reason reads as *there is no more*,
     which on this screen means approving a change you have only seen part of. */
  'work.diff.holdFull': {
    one: 'This browser is holding {count} line of this diff and will not load more. Reopen the review to carry on from a fresh page.',
    other: 'This browser is holding {count} lines of this diff and will not load more. Reopen the review to carry on from a fresh page.',
  },
  'work.diff.moved':
    'The worktree moved while this was open. Load the diff again — half of one tree and half of another is not a change anyone should approve.',
  'work.diff.unavailable':
    'The worktree for this run is gone, so there is no diff to read. That is not the same as a run that changed nothing.',
  'work.diff.status.added': 'Added',
  'work.diff.status.modified': 'Modified',
  'work.diff.status.deleted': 'Deleted',
  'work.diff.status.renamed': 'Renamed',
  'work.diff.status.binary': 'Binary',

  /* The body a verdict carries when the reader typed no note. The machine-readable
     verdict lives in the message's `payload` object and is never read back out of this
     sentence: composing structured content into prose before storage is how four of five
     denylisted keys leaked in M15, and it would also make the verdict untranslatable
     back. Prose here, object there. */
  'work.review.body.approved': 'Approved this change.',
  'work.review.body.changes': 'Asked for changes to this change.',
  'work.review.approve': 'Approve',
  'work.review.changes': 'Request changes',
  'work.review.note': 'A note for the next turn (optional)',
  'work.review.approved': 'Approved. Recorded in this run’s thread, against tree {sha}.',
  'work.review.requested': 'Changes requested. It reaches the agent on its next turn.',
  'work.review.notMerge':
    'This records a verdict in the run’s own thread. It does not push, open a pull request or merge — nothing in this build does.',
  'work.review.noThread':
    'This run’s thread is not known here, so there is nothing to record a verdict against.',
  'work.review.noTree':
    'This page cannot say which tree it read, and a verdict that cannot name what it looked at is a claim with no observation behind it.',
  'work.review.failed': 'The verdict was not recorded. {message}',

  'a11y.mapCanvas': 'Agent galaxy. Use the arrow keys to move between departments.',
  'a11y.drawer': 'Agent detail',
  'a11y.carousel': 'Command centers',
  'a11y.matrix': 'Rollout matrix: autonomy tier by rollout phase',
  'a11y.liveRegion.runStarted': 'Run started.',
  'a11y.liveRegion.runFinished': 'Run finished.',
} as const;

export type StringKey = keyof typeof en;
