/**
 * **The composer's address, along the whole chain — contract → reducer → drawer → control.**
 *
 * `mailbox.test.ts` already pins `RUN_STREAM_CARRIES_THREAD_ID` against
 * `packages/contracts/src/api.ts`, and that pin did its job: it went red inside
 * `runner-engineer`'s M17 commit the moment `SseStartData` grew a `threadId`, which is how
 * this wiring came to exist at all rather than being noticed months later.
 *
 * **But that pin is satisfiable by a lie, and this file exists because the lie was planted
 * and survived.** With the constant flipped to `true` and `JobDrawer`'s `mailboxThreadId`
 * left hardcoded to `null`, all 81 web test files stayed green — a composer permanently
 * disabled while a boolean two modules away claimed the address had arrived. The pin
 * compares a *contract* to a *constant*; neither of those is the drawer, and the drawer was
 * the thing M15 got wrong.
 *
 * So these assert the two links the pin cannot see:
 *   1. the reducer keeps `threadId` off a real `start` event, and
 *   2. the drawer hands that value to the control, which becomes addressable because of it.
 *
 * Both are driven, never injected. Passing a `threadId` prop straight to `MailboxComposer`
 * is a test of the component — `MailboxComposer.test.tsx` owns that — and it is exactly the
 * shape of test that let the M15 `sourceRef` bug through: every provenance test built its
 * own object and handed it in, so the one line that chose *which source to read* was the
 * one line nothing covered.
 */

import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { I18nProvider } from '@/i18n/provider';
import { consoleReducer, initialConsoleState, type ConsoleState } from '../run/console-model';
import type { RunEvent } from '../data/types';

vi.mock('next/navigation', () => ({
  usePathname: () => '/p/agentos/map',
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

/**
 * The drawer's run stream, stubbed at the hook rather than the network.
 *
 * `JobDrawer` calls `useRunStream({ project })` and passes it no transport, so there is no
 * seam below it to inject through. What is under test is the *expression* in the drawer —
 * `run.state.threadId ?? null` versus a hardcoded `null` — and stubbing the hook is what
 * puts that expression, and nothing else, in front of the assertion.
 */
const runState = vi.hoisted(() => ({ current: {} as ConsoleState }));

vi.mock('../run/useRunStream', () => ({
  useRunStream: () => ({
    state: runState.current,
    active: runState.current.phase === 'streaming',
    start: vi.fn(),
    cancel: vi.fn(),
    decide: vi.fn(async () => undefined),
    reset: vi.fn(),
  }),
}));

const { JobDrawer } = await import('../JobDrawer');

/**
 * The `start` member of the union, named.
 *
 * `RunEvent` is a discriminated union and `threadId` lives on one arm of it, so a helper
 * typed `RunEvent` cannot be destructured for the field — `typecheck:tests` said so about
 * an earlier draft of this file, which is the whole reason that gate exists.
 */
type StartEvent = Extract<RunEvent, { type: 'start' }>;

/** A `start` frame exactly as `runService.ts` emits it (contract `SseStartData`). */
const startEvent = (threadId: string | null): StartEvent => ({
  type: 'start',
  runId: 'run_01J',
  agent: 'sales/account-enrichment',
  agentRef: 'agentos/sales/account-enrichment',
  sourceRef: `project:agents/sales/account-enrichment/SKILL.md@sha256:${'c'.repeat(64)}`,
  traceUrl: null,
  startedAt: '2026-08-19T00:00:00.000Z',
  tools: ['exa'],
  approvalRequired: false,
  threadId,
});

describe('the reducer keeps the address the runner sends', () => {
  it('holds threadId off a start event', () => {
    const state = consoleReducer(initialConsoleState, { type: 'event', event: startEvent('th_7QF') });
    expect(state.threadId).toBe('th_7QF');
  });

  /**
   * `null` and absent are different facts and the reducer must not collapse them: `null` is
   * a runner with no thread store (`--profile dev`), absent is a runner too old to say. Both
   * disable the composer, but only one of them is a configuration somebody chose, and a
   * console that cannot tell them apart cannot say which.
   */
  it('distinguishes a runner with no thread store from one too old to say', () => {
    const noStore = consoleReducer(initialConsoleState, { type: 'event', event: startEvent(null) });
    expect(noStore.threadId).toBeNull();

    const { threadId: _dropped, ...old } = startEvent('th_7QF');
    const older = consoleReducer(initialConsoleState, { type: 'event', event: old as RunEvent });
    expect(older.threadId).toBeUndefined();
  });

  /** Never defaulted from the previous run — the rule `agent` and `sourceRef` already follow. */
  it('does not let a run inherit the previous run thread', () => {
    const first = consoleReducer(initialConsoleState, { type: 'event', event: startEvent('th_FIRST') });
    const { threadId: _gone, ...silent } = startEvent('th_FIRST');
    const second = consoleReducer(first, { type: 'event', event: silent as RunEvent });
    expect(second.threadId).toBeUndefined();
  });
});

describe('the drawer hands that address to the composer', () => {
  /** The four reads the drawer makes on open. No run has ever executed; that is the tree. */
  function serve(): void {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        const body = url.includes('/metrics/runs')
          ? { runs: [] }
          // M17's roster. Empty and NOT narrowed — the honest shape of a tree where no run
          // has executed and no project has a repository. Answering the agent detail here
          // instead would exercise the unreadable-body path and quietly stop testing this.
          : url.includes('/work-products')
            ? { workProducts: [], reviewQueue: false }
          : url === '/api/status'
            ? { runnerConfigured: false }
            : {
                slug: 'sales/account-enrichment',
                path: 'agents/sales/account-enrichment/SKILL.md',
                frontmatter: {
                  name: 'Account Enrichment',
                  department: 'sales',
                  cluster: 'enrichment',
                  tier: 'autonomous',
                  description: 'Layer firmographics onto target accounts.',
                  replaces: 'The research step everyone skips.',
                  the_human: 'A human audits outputs on a cadence.',
                  wired_into: ['exa'],
                  breaks_into: [],
                  builds_on: [],
                  ladder: { 'human-led': 'a', assisted: 'b', autonomous: 'c' },
                  inputs: [],
                },
                body: '',
                runnable: { tools: [], missingConnectors: [], approvalRequired: false, scheduled: false },
              };
        return new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });
      }),
    );
  }

  const openWith = async (threadId: string | null) => {
    runState.current = consoleReducer(initialConsoleState, { type: 'event', event: startEvent(threadId) });
    serve();
    const view = render(
      <I18nProvider locale="en">
        <JobDrawer slug="sales/account-enrichment" side="left" open onClose={() => undefined} />
      </I18nProvider>,
    );
    await screen.findByText('Account Enrichment');
    return view;
  };

  afterEach(() => vi.unstubAllGlobals());

  /**
   * The assertion that fails on the planted defect. A drawer that hardcodes `null` renders
   * this textarea disabled while the stream is carrying a perfectly good address.
   */
  it('is addressable while a run that named its thread is streaming', async () => {
    const { container } = await openWith('th_7QF');
    await waitFor(() => {
      const box = container.querySelector('textarea');
      expect(box, 'the mailbox composer did not render inside the open console').not.toBeNull();
      // `.disabled`, not a jest-dom matcher: this suite does not load jest-dom, and
      // `toBeDisabled` there is an unknown Chai property that throws rather than asserting.
      expect((box as HTMLTextAreaElement).disabled).toBe(false);
    });
  });

  /** The other direction: no thread store, no address, and the control says so honestly. */
  it('stays disabled when the runner has no thread store', async () => {
    const { container } = await openWith(null);
    await waitFor(() => {
      const box = container.querySelector('textarea');
      expect(box).not.toBeNull();
      expect((box as HTMLTextAreaElement).disabled).toBe(true);
    });
  });
});
