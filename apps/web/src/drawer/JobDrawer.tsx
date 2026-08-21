'use client';

/**
 * The composing drawer — §2.3 (map, inline-start, glass, full height) and the
 * §2.6.5 chart panel (inline-end mirror). One component, a `side` prop.
 *
 * Every string about an agent is projected from frontmatter (`projectAgent`). Optional
 * sections collapse via `<Section when={…}>`. Run/Schedule stay disabled with an honest
 * tooltip until `GET /api/status` says the runner is actually there.
 *
 * Owner: drawer-engineer
 */

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { DEFAULT_LOCALE, translate, type StringKey, type Vars } from '@/i18n';
import { useProjectSegment, withProject } from '@/components/shell';
import { useFocusTrap } from './a11y/useFocusTrap';
import {
  ApiCallError,
  downloadUrl,
  fetchAgent,
  fetchRuns,
  postSchedule,
  postThreadMessage,
} from './data/client';
import { failureOf } from './data/failure';
import { scheduleSentence } from './data/format';
import { initialValues, toRunPayload, validateInputs, type InputValues } from './data/inputs';
import { projectAgent, type DrawerModel } from './data/project';
import { drawerProvenance, type DrawerProvenance } from './data/provenance';
import type { AgentDoc } from './data/types';
import type { WorkProductSummary } from '@agnetos/contracts';
import { openDrawer } from './events';
import { GlassPanel } from './primitives';
import { useRunStream } from './run/useRunStream';
import { useRunnerAvailability } from './run/useRunnerAvailability';
import { AutonomyToggleRow, SkillCards } from './sections/ChartSections';
import { BreaksIntoChips, BuildsOnChips, ToolChips } from './sections/Chips';
import { DrawerHeader } from './sections/Header';
import { InputsForm, inputFieldId } from './sections/InputsForm';
import { Ladder } from './sections/Ladder';
import { LastRuns, type RunsState } from './sections/LastRuns';
import { Paragraph, QuoteBox, WiredIntoList } from './sections/Prose';
import { RunConsole } from './sections/RunConsole';
import { Section } from './sections/Section';
import { SkillFileCard } from './sections/SkillFileCard';
import type { Sender } from './threads/MailboxComposer';
import { DiffScreen } from './work/DiffScreen';
import { useDiffReview } from './work/useDiffReview';
import { WorkProducts, type WorkProductsState } from './work/WorkProducts';
import { useWorkProducts } from './work/useWorkProducts';
import s from './drawer.module.css';

export type DrawerSide = 'left' | 'right';

export interface JobDrawerProps {
  /** `department/agent-slug`. Null while nothing is selected. */
  slug: string | null;
  /** `left` = map (§2.3, inline-start). `right` = chart mirror (§2.6.5, inline-end). */
  side?: DrawerSide;
  open: boolean;
  onClose: () => void;
}

const t = (key: StringKey, vars?: Vars): string => translate(DEFAULT_LOCALE, key, vars);

type AgentState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'ready'; doc: AgentDoc; model: DrawerModel }
  | { kind: 'failed'; message: string; hint?: string };

export function JobDrawer({ slug, side = 'left', open, onClose }: JobDrawerProps) {
  const isChart = side === 'right';
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement | null>(null);
  const reviewRef = useRef<HTMLDivElement | null>(null);
  /**
   * Which project's library answers (M15, ADR-015). `useProjectSegment` and not
   * `useShell()`: the latter throws outside `<ShellProvider>`, and this component is
   * mounted three ways — the map route, `DrawerHost` on the chart route, and bare in
   * tests. `shell-navigation-engineer`'s call, and it also means the project is read the
   * same way in every mount rather than drilled from two hosts, which would give the
   * drawer two ways to learn one fact.
   */
  const project = useProjectSegment();
  const capabilities = useRunnerAvailability();
  const run = useRunStream({ project });

  const [agent, setAgent] = useState<AgentState>({ kind: 'idle' });
  const [runs, setRuns] = useState<RunsState>({ kind: 'loading' });
  const [values, setValues] = useState<InputValues>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [scheduleBusy, setScheduleBusy] = useState(false);
  const [scheduleResult, setScheduleResult] = useState<string | null>(null);
  const [consoleHeld, setConsoleHeld] = useState(false);
  /**
   * M17 — the roster's filter and the run whose diff is being reviewed.
   *
   * `reviewFilter` is what is being *asked for*; whether the list actually came back
   * narrowed is `state.reviewQueue`, off the response, and the two are deliberately not the
   * same variable.
   */
  const [reviewFilter, setReviewFilter] = useState(false);
  const [reviewing, setReviewing] = useState<WorkProductSummary | null>(null);
  /**
   * The field `▶ Run` refused, waiting to be shown to the person who pressed it.
   *
   * Written by `onRun` and cleared by the effect that acts on it, so a second refusal of the
   * same field still moves the reader — a plain "did it change" guard would move them once
   * and then sit still while they pressed the button again.
   */
  const [refusedField, setRefusedField] = useState<string | null>(null);

  const workProducts: WorkProductsState = useWorkProducts(project, {
    enabled: Boolean(slug) && open,
    review: reviewFilter,
  });
  const diffReview = useDiffReview(project, reviewing);

  /**
   * Esc closes the topmost thing, which is the review screen when one is open.
   *
   * The focus trap listens on `document` in the capture phase, so a handler on the review
   * element would run only after the drawer had already closed underneath it. One layer of
   * state here is the whole fix, and it keeps a single owner for "what does Esc mean".
   */
  const onEscape = useCallback(() => {
    if (reviewing) {
      setReviewing(null);
      return;
    }
    onClose();
  }, [reviewing, onClose]);

  useFocusTrap(panelRef, { active: open, onClose: onEscape });
  /**
   * The review screen is a modal on top of a modal, and it needs its own trap.
   *
   * `.review` is `position: absolute; inset: 0` on `--screen` — opaque, full-bleed, over the
   * whole panel. The drawer's trap above is keyed on `open`, so for the whole of M17 wave 2
   * opening the review did two wrong things at once: focus stayed on the `Review` pill that
   * was now behind an opaque panel, and every control underneath — filter chips, roster
   * pills, thread links, the inputs form — stayed in the tab order, so Tab walked through
   * controls a person could not see.
   *
   * Two mechanisms, and both are needed. This trap **puts focus into the review** and holds
   * it there; `obscured` below marks the body and the console `inert`, which is what removes
   * them from the browser's tab order *and* from `focusables()`. Neither alone is the fix:
   * a trap with the body still tabbable cycles through invisible controls, and `inert`
   * without a trap leaves focus parked on a hidden pill.
   *
   * Both traps stay active together on purpose. With the body inert they compute the same
   * list — the review's own controls — so the outer one is a no-op rather than a competitor,
   * and `onEscape` is idempotent, which is what makes running twice harmless.
   */
  useFocusTrap(reviewRef, { active: open && Boolean(reviewing), onClose: onEscape });

  useEffect(() => {
    if (!slug || !open) {
      setAgent({ kind: 'idle' });
      return;
    }
    const controller = new AbortController();
    setAgent({ kind: 'loading' });
    setScheduleResult(null);
    setErrors({});
    fetchAgent(project, slug, controller.signal)
      .then((doc) => {
        const model = projectAgent(doc);
        setAgent({ kind: 'ready', doc, model });
        setValues(initialValues(model.inputs.fields));
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        // `answered`: the only way a non-`ApiCallError` reaches here is `normalizeAgentDoc`
        // throwing on a body that already arrived, so something did reply. `getJson` owns
        // every other outcome and labels its own.
        const failure =
          error instanceof ApiCallError
            ? error
            : new ApiCallError('This agent could not be loaded.', undefined, undefined, 'answered');
        setAgent({ kind: 'failed', message: failure.message, hint: failure.hint });
      });
    return () => controller.abort();
  }, [slug, open, project]);

  useEffect(() => {
    if (!slug || !open) {
      setRuns({ kind: 'loading' });
      return;
    }
    const controller = new AbortController();
    setRuns({ kind: 'loading' });
    fetchRuns(project, slug, 5, controller.signal)
      .then((rows) => setRuns({ kind: 'ready', rows }))
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        // `failureOf`, not `error.message`. This branch used to keep only the message and
        // the section opened it with "Couldn't reach the runner" — so a 503
        // `metrics_unavailable`, which is what this stack answers every time, was rendered
        // as a network fault with the runner's own contradicting words after it. The hint
        // was dropped on the floor here too.
        setRuns({ kind: 'failed', failure: failureOf(error) });
      });
    return () => controller.abort();
  }, [slug, open, project]);

  useEffect(() => {
    if (run.active || run.state.phase === 'done' || run.state.phase === 'error') setConsoleHeld(true);
  }, [run.active, run.state.phase]);

  /**
   * `▶ Run now`, and the two-screen gap it used to fail into.
   *
   * `INPUTS` is one of *our* additions to §2.3, and it sat **1,375px** below the button that
   * feeds it — `▶ Run now` at y=303, the first required field at y=1,678 in an 1,782px scroll
   * body, measured in Chrome at 1440×900. Nine spec sections in between. So the whole of this
   * failure path wrote field errors onto a part of the page nobody was looking at: press a
   * button, watch nothing happen, and there is no way to find out why without scrolling past
   * the ladder. The section moved directly under the card (`RunBlock`), and this moves the
   * reader to the first field that was actually refused.
   *
   * The first refused field is taken **in field order**, not in `Object.keys(errors)` order: a
   * validator that reports out of order would otherwise send the reader to the second problem
   * and let them find the first one themselves.
   */
  const onRun = useCallback(() => {
    if (!slug || agent.kind !== 'ready') return;
    const { fields } = agent.model.inputs;
    const result = validateInputs(fields, values);
    if (!result.ok) {
      setErrors(result.errors);
      setRefusedField(fields.find((field) => result.errors[field.key])?.key ?? null);
      return;
    }
    setErrors({});
    setRefusedField(null);
    setConsoleHeld(true);
    run.start({ agent: slug, inputs: toRunPayload(fields, values) });
  }, [agent, run, slug, values]);

  /**
   * An effect and not a `requestAnimationFrame` inside the handler: the error paragraph this
   * is scrolling to does not exist until React has committed `setErrors`, and an effect is the
   * only place the DOM is guaranteed to be there. `scrollIntoView` is called optionally
   * because jsdom does not implement it — the browser centres the field, the suite proves the
   * focus moved, and neither instrument is asked for what it cannot see.
   */
  useEffect(() => {
    if (refusedField === null) return;
    const field = panelRef.current?.ownerDocument.getElementById(inputFieldId(refusedField));
    field?.scrollIntoView?.({ block: 'center' });
    field?.focus({ preventScroll: true });
    setRefusedField(null);
  }, [refusedField]);

  /**
   * §2.3 item 4's ⏰ Schedule, and the sentence it is allowed to say afterwards.
   *
   * **What actually happens: the cron is written into the agent's frontmatter and committed**
   * (REQ-RUN-16, `apps/runner/src/lib/schedule.ts`). That part is real and it is what the
   * sentence reports.
   *
   * **What does not happen: anything fires.** The ofelia sidecar left the stack at `e4e0bff`
   * and the coordinator's clock does not run — `scheduler-engineer` built the computation and
   * the routes and their own handoff says so. The response still carries `nextRunAt`, but it
   * is `nextRunAt(cron)` — an occurrence *computed from the expression*, not an appointment
   * anything holds. Printing it was rule 9's defect in its purest form: a declared value read
   * as an observed one, on the one M18 surface a person can touch, and worse than an error
   * because it succeeded silently. Someone scheduled an agent, was told when it would next
   * run, and nothing was ever going to happen.
   *
   * So the sentence is **the server's**, not this drawer's. `runner-engineer` fixed the shape
   * at the source (`4937d0b`): `nextRunAt` no longer exists on the wire, `firedBy: 'nobody'`
   * says who will act, `nextMatchAt` says in its own name that it is arithmetic on the
   * expression, and `executionNote` is one sentence written behind an exhaustive switch on
   * `firedBy` — so the day an executor lands, the compiler stops the runner until the wording
   * catches up. `scheduleSentence` renders it and composes nothing from a time. The time is
   * not drawn at all: a rendered value out-argues an adjacent caveat, which is the same
   * ruling this drawer already made for `ci_state`.
   */
  const onSchedule = useCallback(
    (cron: string) => {
      if (!slug) return;
      setScheduleBusy(true);
      postSchedule(project, slug, cron)
        .then((response) =>
          setScheduleResult(
            scheduleSentence(response) ??
              'Saved to the agent’s file. This runner did not say whether anything will act on it, so nothing here can claim it will run.',
          ),
        )
        .catch((error: unknown) => {
          setScheduleResult(error instanceof Error ? error.message : 'The schedule could not be saved.');
        })
        .finally(() => setScheduleBusy(false));
    },
    [slug, project],
  );

  const onDismissConsole = useCallback(() => {
    run.reset();
    setConsoleHeld(false);
  }, [run]);

  /**
   * The mailbox composer's address — `ops.thread.id`, read off the run stream (`Plan §12`).
   *
   * Every run opens or continues a thread (`runService.ts` step 0b) and `SseStartData` now
   * carries its id, so a streaming run can finally name the conversation it belongs to.
   * `null` keeps its old meaning and the composer keeps its old behaviour — **disabled with
   * the reason** — for the two states that still have no address: no run has started in this
   * drawer yet, or the runner has no thread store at all (`--profile dev`).
   *
   * **This line was `null` for the whole of M16, and the pin above it is why it is not now.**
   * `threads/mailbox.ts` declared `RUN_STREAM_CARRIES_THREAD_ID = false` while
   * `mailbox.test.ts` read `packages/contracts/src/api.ts` — so when M17 added `threadId` to
   * `SseStartData`, the test went red *inside `runner-engineer`'s own commit*, and this line
   * had to be wired before the tree was green again. M15 shipped a `sourceRef` producer whose
   * consumer never landed and the header read SOURCE UNKNOWN for every agent with nothing red
   * anywhere; that is the failure this collected instead.
   */
  const mailboxThreadId: string | null = run.state.threadId ?? null;

  const sendMessage = useCallback<Sender>(
    (threadId, input) => postThreadMessage(project, threadId, input),
    [project],
  );

  /**
   * `/p/:project/threads/:id` — where *"asked you something"* goes.
   *
   * `null` when the address bar names no project, and the roster then renders no link rather
   * than one at the unscoped legacy path. Same rule the API client follows: a `null` project
   * means *do not ask*, never *ask the unscoped one*.
   */
  const threadHref = useCallback(
    (threadId: string): string | null =>
      project ? withProject(`/threads/${encodeURIComponent(threadId)}`, project) : null,
    [project],
  );

  const model = agent.kind === 'ready' ? agent.model : null;
  /**
   * `Plan §23.6` — which library this agent came from.
   *
   * Derived on every render from the two things that can say — the fetched `AgentDetail`
   * first, the run stream second — and never stored, so it is a projection of the cascade
   * rather than a copy the drawer keeps: there is no state to update, nothing to invalidate
   * and no way for it to survive a change it did not see. Opening a second drawer cannot
   * inherit the first one's answer: the doc is refetched, and `provenanceOfAgent` refuses to
   * attribute a run's provenance to any agent but the one that ran.
   *
   * **This line read the run stream alone for the whole of M15**, which meant SOURCE UNKNOWN
   * on every agent, because no run has ever executed. `data/provenance.ts` carries the full
   * account; `JobDrawer.test.tsx` now drives this expression from a fetched `AgentDetail`
   * with no run, which is the only test that would have caught it.
   */
  const provenance: DrawerProvenance = drawerProvenance(
    slug,
    agent.kind === 'ready' ? agent.doc.sourceRef : null,
    run.state,
  );
  const view = isChart ? 'chart' : 'map';
  const state = open ? 'open' : 'closed';

  return (
    <>
      <button
        type="button"
        className={s.scrim}
        data-state={state}
        onClick={onClose}
        tabIndex={open ? 0 : -1}
        aria-label={t('drawer.action.close')}
      />
      <aside
        className={s.drawer}
        data-side={isChart ? 'end' : 'start'}
        data-view={view}
        data-state={state}
        data-testid="job-drawer"
        aria-hidden={open ? undefined : true}
        {...(!open ? { inert: true } : {})}
      >
        <GlassPanel
          ref={panelRef}
          className={s.panel}
          radius="md"
          shadow="drawer"
          bordered={false}
          role="dialog"
          aria-modal={open ? true : undefined}
          aria-labelledby={titleId}
          aria-label={t('a11y.drawer')}
          tabIndex={-1}
        >
          {/* `inert` rather than `aria-hidden`: the review over it is opaque, and a control
            * behind an opaque panel must leave the tab order, not merely the accessibility
            * tree. `focusables()` honours an inert ancestor as of this slice — before that
            * it asked `getAttribute('inert')` on the element alone and this would have been
            * a declaration with no mechanism behind it. */}
          <div className={s.body} {...(reviewing ? { inert: true } : {})}>
            {agent.kind === 'loading' || agent.kind === 'idle' ? (
              <p className={s.status}>{t('drawer.empty.loading')}</p>
            ) : null}

            {agent.kind === 'failed' ? (
              <div className={s.status}>
                <p>{t('drawer.empty.missing')}</p>
                <p className={s.statusHint}>{[agent.message, agent.hint].filter(Boolean).join(' ')}</p>
              </div>
            ) : null}

            {model ? (
              isChart ? (
                <ChartAnatomy
                  model={model}
                  provenance={provenance}
                  titleId={titleId}
                  onClose={onClose}
                  capabilities={capabilities}
                  values={values}
                  errors={errors}
                  onChange={(key, value) => setValues((prev) => ({ ...prev, [key]: value }))}
                  onRun={onRun}
                  onSchedule={onSchedule}
                  running={run.active}
                  scheduleBusy={scheduleBusy}
                  scheduleResult={scheduleResult}
                  downloadHref={downloadUrl(project, model.slug)}
                  runs={runs}
                  workProducts={workProducts}
                  reviewFilter={reviewFilter}
                  onReviewFilter={setReviewFilter}
                  onOpenDiff={setReviewing}
                  threadHref={threadHref}
                />
              ) : (
                <MapAnatomy
                  model={model}
                  provenance={provenance}
                  titleId={titleId}
                  onClose={onClose}
                  capabilities={capabilities}
                  values={values}
                  errors={errors}
                  onChange={(key, value) => setValues((prev) => ({ ...prev, [key]: value }))}
                  onRun={onRun}
                  onSchedule={onSchedule}
                  running={run.active}
                  scheduleBusy={scheduleBusy}
                  scheduleResult={scheduleResult}
                  downloadHref={downloadUrl(project, model.slug)}
                  runs={runs}
                  workProducts={workProducts}
                  reviewFilter={reviewFilter}
                  onReviewFilter={setReviewFilter}
                  onOpenDiff={setReviewing}
                  threadHref={threadHref}
                />
              )
            ) : null}
          </div>

          <RunConsole
            state={run.state}
            open={consoleHeld}
            threadId={mailboxThreadId}
            sendMessage={sendMessage}
            onDecide={(decision) => void run.decide(decision)}
            onCancel={run.cancel}
            onDismiss={onDismissConsole}
            obscured={Boolean(reviewing)}
          />

          {/* The diff review screen, over the drawer and over the console. Mounted rather
            * than conditionally rendered so the slide-up has something to animate from,
            * and `inert` while closed so its controls are not in the tab order. */}
          <DiffScreen
            open={Boolean(reviewing)}
            rootRef={reviewRef}
            state={diffReview.state}
            loadingMore={diffReview.loadingMore}
            onLoadMore={diffReview.loadMore}
            onClose={() => setReviewing(null)}
            note={diffReview.note}
            onNoteChange={diffReview.setNote}
            onVerdict={diffReview.submit}
            result={diffReview.result}
            reviewRefusal={diffReview.refusal}
            busy={diffReview.busy}
          />
        </GlassPanel>
      </aside>
    </>
  );
}

interface AnatomyProps {
  model: DrawerModel;
  /** `Plan §23.6`. Both anatomies render it identically — one question, one answer. */
  provenance: DrawerProvenance;
  titleId: string;
  onClose: () => void;
  capabilities: ReturnType<typeof useRunnerAvailability>;
  values: InputValues;
  errors: Record<string, string>;
  onChange: (key: string, value: string) => void;
  onRun: () => void;
  onSchedule: (cron: string) => void;
  running: boolean;
  scheduleBusy: boolean;
  scheduleResult: string | null;
  /** `null` when the URL names no project, so there is no address to link at. */
  downloadHref: string | null;
  runs: RunsState;
  /** M17 — the project's roster (`Plan §13`). One route for N runs, never one per row. */
  workProducts: WorkProductsState;
  reviewFilter: boolean;
  onReviewFilter: (review: boolean) => void;
  onOpenDiff: (summary: WorkProductSummary) => void;
  threadHref: (threadId: string) => string | null;
}

function MapAnatomy({
  model,
  provenance,
  titleId,
  onClose,
  capabilities,
  values,
  errors,
  onChange,
  onRun,
  onSchedule,
  running,
  scheduleBusy,
  scheduleResult,
  downloadHref,
  runs,
  workProducts,
  reviewFilter,
  onReviewFilter,
  onOpenDiff,
  threadHref,
}: AnatomyProps) {
  return (
    <>
      <DrawerHeader
        eyebrow={model.eyebrow}
        title={model.title}
        breadcrumb={model.breadcrumb}
        description={model.description}
        provenance={provenance}
        titleId={titleId}
        onClose={onClose}
        closeLabel={t('drawer.action.close')}
      />

      <RunBlock
        model={model}
        capabilities={capabilities}
        values={values}
        errors={errors}
        onChange={onChange}
        onRun={onRun}
        onSchedule={onSchedule}
        running={running}
        scheduleBusy={scheduleBusy}
        scheduleResult={scheduleResult}
        downloadHref={downloadHref}
      />

      <Section label={t('drawer.section.breaksInto')} when={model.breaksInto.length > 0}>
        <BreaksIntoChips items={model.breaksInto} />
      </Section>
      <Section label={t('drawer.section.wiredInto')} when={model.wiredInto.length > 0}>
        <WiredIntoList tools={model.wiredInto} />
      </Section>
      <Section label={t('drawer.section.buildsOn')} when={model.buildsOn.length > 0}>
        <BuildsOnChips items={model.buildsOn} view="map" />
      </Section>
      <Section label={t('drawer.section.replaces')} when={Boolean(model.replaces)}>
        <QuoteBox text={model.replaces ?? ''} />
      </Section>
      <Section label={t('drawer.section.ladder')} when={model.ladder.length > 0}>
        <Ladder rows={model.ladder} />
      </Section>
      <Section label={t('drawer.section.theHuman')} when={Boolean(model.theHuman)}>
        <Paragraph text={model.theHuman ?? ''} />
      </Section>

      <Additions
        runs={runs}
        workProducts={workProducts}
        reviewFilter={reviewFilter}
        onReviewFilter={onReviewFilter}
        onOpenDiff={onOpenDiff}
        threadHref={threadHref}
      />
    </>
  );
}

function ChartAnatomy({
  model,
  provenance,
  titleId,
  onClose,
  capabilities,
  values,
  errors,
  onChange,
  onRun,
  onSchedule,
  running,
  scheduleBusy,
  scheduleResult,
  downloadHref,
  runs,
  workProducts,
  reviewFilter,
  onReviewFilter,
  onOpenDiff,
  threadHref,
}: AnatomyProps) {
  return (
    <>
      <DrawerHeader
        eyebrow={model.clusterEyebrow}
        title={model.title}
        breadcrumb={model.breadcrumb}
        description={null}
        provenance={provenance}
        titleId={titleId}
        onClose={onClose}
        closeLabel={t('drawer.action.close')}
      />
      <AutonomyToggleRow tier={model.tier} />

      <Section label={t('drawer.section.replaces')} when={Boolean(model.replaces)}>
        <QuoteBox text={model.replaces ?? ''} cost />
      </Section>
      <Section label={t('drawer.section.whatItDoes')} when={Boolean(model.description)}>
        <Paragraph text={model.description ?? ''} />
      </Section>
      <Section label={t('drawer.section.fromManualToAutonomous')} when={model.ladder.length > 0}>
        <Ladder rows={model.ladder} nowBadge />
      </Section>
      <Section label={t('drawer.section.skills')} when={model.skills.length > 0}>
        <SkillCards
          skills={model.skills}
          capabilities={capabilities}
          onRead={(skill) => {
            if (skill.agentSlug) openDrawer({ slug: skill.agentSlug, view: 'chart' });
          }}
          onRun={(skill) => {
            if (skill.agentSlug) openDrawer({ slug: skill.agentSlug, view: 'chart' });
          }}
        />
      </Section>
      <Section label={t('drawer.section.tools')} when={model.wiredInto.length > 0}>
        <ToolChips tools={model.wiredInto} />
      </Section>
      <Section label={t('drawer.section.howToRunIt')} when={Boolean(model.howToRun)}>
        <Paragraph text={model.howToRun ?? ''} />
      </Section>

      <RunBlock
        model={model}
        capabilities={capabilities}
        values={values}
        errors={errors}
        onChange={onChange}
        onRun={onRun}
        onSchedule={onSchedule}
        running={running}
        scheduleBusy={scheduleBusy}
        scheduleResult={scheduleResult}
        downloadHref={downloadHref}
      />

      <Additions
        runs={runs}
        workProducts={workProducts}
        reviewFilter={reviewFilter}
        onReviewFilter={onReviewFilter}
        onOpenDiff={onOpenDiff}
        threadHref={threadHref}
      />
    </>
  );
}

/**
 * The button and the form it feeds, as one block, in both anatomies.
 *
 * `INPUTS` is ours, not §2.3's — items 1–10 are the spec's order and do not move — so its
 * position was ours to choose, and it was chosen badly: nine sections and 1,375px below the
 * `▶ Run now` it fills. Two drawers, one component set: the map places this at item 4, the
 * chart places it where its own card already was, and neither owns a second copy of the pair.
 *
 * The section still collapses silently when an agent declares no `inputs:` — a card with an
 * empty header under it would be worse than the distance was.
 */
function RunBlock({
  model,
  capabilities,
  values,
  errors,
  onChange,
  onRun,
  onSchedule,
  running,
  scheduleBusy,
  scheduleResult,
  downloadHref,
}: Pick<
  AnatomyProps,
  | 'model'
  | 'capabilities'
  | 'values'
  | 'errors'
  | 'onChange'
  | 'onRun'
  | 'onSchedule'
  | 'running'
  | 'scheduleBusy'
  | 'scheduleResult'
  | 'downloadHref'
>) {
  const hasInputs = model.inputs.fields.length > 0 || model.inputs.unsupported.length > 0;
  return (
    <>
      <SkillFileCard
        fileCount={model.skillFileCount}
        downloadHref={downloadHref}
        capabilities={capabilities}
        schedule={model.schedule}
        onRun={onRun}
        onSchedule={onSchedule}
        running={running}
        scheduleBusy={scheduleBusy}
        scheduleResult={scheduleResult}
      />
      <Section label={t('drawer.section.inputs')} when={hasInputs}>
        <InputsForm
          fields={model.inputs.fields}
          unsupported={model.inputs.unsupported}
          values={values}
          errors={errors}
          onChange={onChange}
        />
      </Section>
    </>
  );
}

function Additions({
  runs,
  workProducts,
  reviewFilter,
  onReviewFilter,
  onOpenDiff,
  threadHref,
  // `provenance` is omitted, not passed and ignored: it belongs to the header and the
  // sections below it must not grow a second opinion about where the agent came from.
}: Pick<
  AnatomyProps,
  'runs' | 'workProducts' | 'reviewFilter' | 'onReviewFilter' | 'onOpenDiff' | 'threadHref'
>) {
  return (
    <>
      <Section label={t('drawer.section.lastRuns')}>
        <LastRuns state={runs} />
      </Section>
      {/* M17 · `Plan §13`. Rendered in both anatomies from one component set, like every
        * other section here — two drawers, one component set, a `side` prop. */}
      <Section label={t('drawer.section.work')}>
        <WorkProducts
          state={workProducts}
          review={reviewFilter}
          onReviewFilter={onReviewFilter}
          onOpenDiff={onOpenDiff}
          threadHref={threadHref}
        />
      </Section>
    </>
  );
}
