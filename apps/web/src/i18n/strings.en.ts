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
   * THREADS — the fourth tab (`Plan §23.8`). Scaffold copy only: these two
   * screens are `ViewMount` placeholders that `sessions-relay-engineer` deletes
   * when the real view lands, so both keys go with them.
   *
   * They are catalogued anyway rather than typed into the JSX, because the
   * alternative was raising the RTL baseline for a surface that ships this
   * milestone — and "it is temporary" is how every untranslated string in this
   * app got here.
   *
   * **One body sentence for both screens, and deliberately short.** The first
   * draft was two paragraphs of English rhythm that would have gone into
   * `strings.ar.ts` as two `todo()`s — which would have put the untranslated
   * count at exactly the ceiling `i18n.test.ts` sets, leaving the next agent to
   * file an honest gap with nowhere to put it. That test's own comment names
   * that trap. Scaffold copy is not worth spending somebody else's budget on, so
   * it says the one thing that is true and stops: nothing has ever run.
   * ------------------------------------------------------------------------ */
  'threads.mount.title': 'Threads',
  'threads.mount.one.title': 'One thread',
  'threads.mount.body':
    'The thread list and its message composer land here. Nothing has ever run, so there is no thread to show.',

  /* ---------------------------------------------------------------------------
   * §3.1 SESSIONS. Still live: `/sessions` and `/sessions/:id` are paths under
   * the THREADS tab after M16, not a view of their own.
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
  'sessions.spawn': 'A new session starts on a machine running Claude Code, not in this browser. Pair that machine with the relay and it will appear here.',
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

  'a11y.mapCanvas': 'Agent galaxy. Use the arrow keys to move between departments.',
  'a11y.drawer': 'Agent detail',
  'a11y.carousel': 'Command centers',
  'a11y.matrix': 'Rollout matrix: autonomy tier by rollout phase',
  'a11y.liveRegion.runStarted': 'Run started.',
  'a11y.liveRegion.runFinished': 'Run finished.',
} as const;

export type StringKey = keyof typeof en;
