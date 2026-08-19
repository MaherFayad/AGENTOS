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
import { useProjectSegment } from '@/components/shell';
import { useFocusTrap } from './a11y/useFocusTrap';
import {
  ApiCallError,
  downloadUrl,
  fetchAgent,
  fetchRuns,
  postSchedule,
  postThreadMessage,
} from './data/client';
import { initialValues, toRunPayload, validateInputs, type InputValues } from './data/inputs';
import { projectAgent, type DrawerModel } from './data/project';
import { drawerProvenance, type DrawerProvenance } from './data/provenance';
import type { AgentDoc } from './data/types';
import { openDrawer } from './events';
import { GlassPanel } from './primitives';
import { useRunStream } from './run/useRunStream';
import { useRunnerAvailability } from './run/useRunnerAvailability';
import { AutonomyToggleRow, SkillCards } from './sections/ChartSections';
import { BreaksIntoChips, BuildsOnChips, ToolChips } from './sections/Chips';
import { DrawerHeader } from './sections/Header';
import { InputsForm } from './sections/InputsForm';
import { Ladder } from './sections/Ladder';
import { LastRuns, type RunsState } from './sections/LastRuns';
import { Paragraph, QuoteBox, WiredIntoList } from './sections/Prose';
import { RunConsole } from './sections/RunConsole';
import { Section } from './sections/Section';
import { SkillFileCard } from './sections/SkillFileCard';
import type { Sender } from './threads/MailboxComposer';
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

  useFocusTrap(panelRef, { active: open, onClose });

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
        const failure = error instanceof ApiCallError ? error : new ApiCallError('This agent could not be loaded.');
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
        setRuns({
          kind: 'failed',
          message: error instanceof Error ? error.message : 'The runs list could not be read.',
        });
      });
    return () => controller.abort();
  }, [slug, open, project]);

  useEffect(() => {
    if (run.active || run.state.phase === 'done' || run.state.phase === 'error') setConsoleHeld(true);
  }, [run.active, run.state.phase]);

  const onRun = useCallback(() => {
    if (!slug || agent.kind !== 'ready') return;
    const { fields } = agent.model.inputs;
    const result = validateInputs(fields, values);
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    setErrors({});
    setConsoleHeld(true);
    run.start({ agent: slug, inputs: toRunPayload(fields, values) });
  }, [agent, run, slug, values]);

  const onSchedule = useCallback(
    (cron: string) => {
      if (!slug) return;
      setScheduleBusy(true);
      postSchedule(project, slug, cron)
        .then((response) => {
          setScheduleResult(
            response.nextRunAt
              ? `Saved. Next run ${response.nextRunAt}.`
              : 'Saved. The schedule is in the agent’s file.',
          );
        })
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
          <div className={s.body}>
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
        runs={runs}
        includeSkillCard={false}
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

      <Additions
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
        runs={runs}
        includeSkillCard
      />
    </>
  );
}

function Additions({
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
  runs,
  includeSkillCard,
  // `provenance` is omitted, not passed and ignored: it belongs to the header and the
  // sections below it must not grow a second opinion about where the agent came from.
}: Omit<AnatomyProps, 'titleId' | 'onClose' | 'provenance'> & { includeSkillCard: boolean }) {
  const hasInputs = model.inputs.fields.length > 0 || model.inputs.unsupported.length > 0;

  return (
    <>
      {includeSkillCard ? (
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
      ) : null}

      <Section label={t('drawer.section.lastRuns')}>
        <LastRuns state={runs} />
      </Section>
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
