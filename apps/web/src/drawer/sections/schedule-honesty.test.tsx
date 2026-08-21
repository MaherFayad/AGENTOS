/**
 * REQ-DRW-SCHEDULE-HONEST — ⏰ Schedule may report a commit; it may not promise a run.
 *
 * §2.3 item 4. The save genuinely writes `schedule:` into the agent's frontmatter and commits
 * it (REQ-RUN-16). Nothing fires it: the cron sidecar left `infra/compose.yaml` at `e4e0bff`
 * and the coordinator's scheduling plane records fires rather than starting runs, so
 * `ScheduleResponse.firedBy` is `'nobody'`. For one milestone this drawer printed
 * *"Saved. Next run {nextRunAt}."* over that — the worst kind of rule 9 failure, because it
 * succeeded silently: a person scheduled an agent, was told when it would next run, and
 * nothing was ever going to happen.
 *
 * Both halves are asserted here, and the second one is the one that keeps working:
 *
 *   1. the drawer renders the **server's** `executionNote` verbatim, rather than a sentence
 *      it maintains independently of the mechanism;
 *   2. it renders **no time at all** — not the response's, not one of its own — because a
 *      rendered value out-argues any caveat printed beside it.
 *
 * (2) is deliberately written against *any* timestamp rather than against the old field name.
 * A test pinned to `nextRunAt` would go quiet the moment the field were renamed while the
 * drawer still composed a promise from the new one, which is exactly the accident that made
 * the sentence honest before this fix — absence, not design.
 *
 * ## The surface it could not see, and now does
 *
 * Everything above rendered `<JobDrawer>` with its default `side="left"`, so for the whole of
 * M17 and M18 **this suite only ever saw the map anatomy** — and `HOW TO RUN IT` exists only
 * in the chart one. `composeHowToRun` went on emitting *"It also runs itself every Monday at
 * 06:00."* through both fixes, on the one surface a suite written to catch that exact claim
 * could not reach. The drawer contradicted itself 40px apart: that paragraph asserted an
 * execution and the card below it named the absent executor. An include-list is a decision to
 * be blind to everything unnamed, and a `side` prop with one value tested is an include-list.
 * The last `describe` renders both anatomies from the same list, so a third would have to be
 * added here to be missed again.
 *
 * ## What this suite still cannot see
 *
 * - It never contacts the runner. That `executionNote` is authored behind an exhaustive
 *   switch on `ScheduleFiredBy` is `apps/runner`'s to prove, and it does.
 * - It stubs `runnerConfigured: true`. **On the real dev stack that flag is `false`, so
 *   `⏰ Schedule` is disabled, the cron editor never opens and `executionNote` cannot reach
 *   a screen at all** — the save path is proved here and nowhere a person can stand.
 * - It renders the default locale. This sentence is uncatalogued English on an uncatalogued
 *   card, like the rest of `SkillFileCard` — filed, not fixed here.
 *
 * Owner: drawer-engineer · Consumes: packages/contracts/src/api.ts `ScheduleResponse`
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { I18nProvider } from '@/i18n';
import { JobDrawer } from '../JobDrawer';
import type { ScheduleResponse } from '@agnetos/contracts';
import { scheduleSentence } from '../data/format';
import type { AgentDoc } from '../data/types';

vi.mock('next/navigation', () => ({
  usePathname: () => '/p/agentos/map',
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

const FRONTMATTER: AgentDoc['frontmatter'] = {
  name: 'Account Enrichment',
  department: 'sales',
  cluster: 'enrichment',
  tier: 'autonomous',
  description: 'Layer firmographics onto target accounts.',
  wired_into: ['exa'],
  // Already scheduled in its own file, which is the state this suite's first case reads.
  schedule: '0 6 * * 1',
};

/** The runner's real reply on this build. `nextMatchAt` is arithmetic, not an appointment. */
const NOTE =
  'Written into the agent’s file and committed. Nothing in this build fires schedules, so it will not run at 2026-08-20T06:00:00.000Z or at any other time until an executor exists.';

const RESPONSE = {
  ok: true,
  agent: 'sales/account-enrichment',
  cron: '0 6 * * 1',
  commitSha: 'f'.repeat(40),
  firedBy: 'nobody',
  nextMatchAt: '2026-08-20T06:00:00.000Z',
  executionNote: NOTE,
};

/** Every ISO-8601-shaped instant, which is the only kind of time this screen could print. */
const ISO = /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/g;

function serve(scheduleBody: unknown): void {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      const body = url.includes('/schedule')
        ? scheduleBody
        : url.includes('/work-products')
          ? { workProducts: [], reviewQueue: false }
          : url.includes('/metrics/runs')
            ? { runs: [] }
            : url === '/api/status'
              ? // Ready, so Schedule is enabled at all. `runnerConfigured: false` disables it
                // and this suite would then assert nothing.
                { runnerConfigured: true }
              : {
                  slug: 'sales/account-enrichment',
                  path: 'agents/sales/account-enrichment/SKILL.md',
                  sourceRef: null,
                  frontmatter: FRONTMATTER,
                  body: '',
                  runnable: {
                    tools: [],
                    missingConnectors: [],
                    approvalRequired: false,
                    scheduled: false,
                  },
                };
      return new Response(JSON.stringify(body), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }),
  );
}

afterEach(() => vi.unstubAllGlobals());

async function saveASchedule(scheduleBody: unknown) {
  serve(scheduleBody);
  const { container } = render(
    <I18nProvider locale="en">
      <JobDrawer slug="sales/account-enrichment" open onClose={() => undefined} />
    </I18nProvider>,
  );
  await screen.findByText('Account Enrichment');

  fireEvent.click(await screen.findByRole('button', { name: /Schedule/ }));
  fireEvent.change(await screen.findByLabelText(/^Cron/), { target: { value: '0 6 * * 1' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save schedule' }));

  return container;
}

describe('a cron already in frontmatter is a declaration, not a state', () => {
  /**
   * The same defect standing still. `schedule: 0 6 * * 1` in an agent's file used to render
   * as *"Scheduled: every Monday at 06:00."* — which asserts that something reads it on a
   * timer. Nothing does. This one has no server sentence to defer to, because nothing was
   * posted: it is frontmatter the drawer already had. So the assertion is that the absent
   * executor is named in the same breath as the expression, every time the expression shows.
   */
  it('names the absent executor beside the expression it read out of the file', async () => {
    serve(RESPONSE);
    const { container } = render(
      <I18nProvider locale="en">
        <JobDrawer
          slug="sales/account-enrichment"
          open
          onClose={() => undefined}
        />
      </I18nProvider>,
    );
    await screen.findByText('Account Enrichment');
    await waitFor(() => expect(container.textContent).toContain('every Monday at 06:00'));

    expect(container.textContent).toContain('Nothing in this build acts on that yet');
    // The bare state claim, in the exact spelling that shipped.
    expect(container.textContent).not.toContain('Scheduled: every Monday');
  });
});

describe('the schedule save says what happened and not what will', () => {
  it('renders the runner’s own sentence rather than one the drawer composed', async () => {
    const container = await saveASchedule(RESPONSE);
    await waitFor(() => expect(container.textContent).toContain(NOTE));
  });

  it('prints no instant anywhere on the card — not even the one the response carries', async () => {
    const container = await saveASchedule({ ...RESPONSE, executionNote: 'Committed. Nothing runs it.' });

    await waitFor(() => expect(container.textContent).toContain('Committed. Nothing runs it.'));
    // The response carried `nextMatchAt`. Nothing drew it, and nothing derived a time from it.
    expect(container.textContent).toContain('Nothing runs it');
    expect(container.textContent?.match(ISO) ?? []).toEqual([]);
  });

  /**
   * A runner older than the contract sends no `executionNote`. The drawer must then say the
   * one thing it observed — the request succeeded — and claim nothing about firing. Composing
   * from `nextMatchAt` in that branch would rebuild the original defect behind a version
   * check, which is why the fallback is asserted rather than left to chance.
   */
  it('claims nothing about firing when the runner sends no sentence at all', async () => {
    // A payload the contract cannot describe: `executionNote` is required on
    // `ScheduleResponse`, so an older runner's reply is only expressible as a cast. That the
    // cast is needed *is* the guarantee — a wire shape missing this field is not a shape
    // this client is typed to receive.
    const { executionNote: _dropped, ...older } = RESPONSE;
    const container = await saveASchedule(older);

    // `scheduleSentence` returns `null` for a response with no note (this module's rule:
    // absence is `null`, the caller writes the sentence), so the assertion is on what the
    // reader actually sees rather than on the helper's return value.
    expect(scheduleSentence(older as unknown as ScheduleResponse)).toBeNull();
    await waitFor(() =>
      expect(container.textContent).toContain('did not say whether anything will act on it'),
    );
    expect(container.textContent?.match(ISO) ?? []).toEqual([]);
    expect(container.textContent).not.toContain('Next run');
  });
});

/**
 * Both anatomies, one list, because the defect this catches was *a surface nobody rendered*
 * rather than a wording anybody argued about.
 *
 * `HOW TO RUN IT` (§2.6.5) is assembled by `composeHowToRun` from frontmatter, and its cron
 * clause is the same claim as the card's: a `schedule:` in a file is a declaration, and
 * saying the agent "runs itself" asserts that something reads it on a timer. `firedBy` is
 * `'nobody'`. The assertion is therefore on the *claim*, not on one spelling of it — the
 * card's honest clause must be present and no sentence anywhere may put the agent in the
 * present tense as its own executor.
 */
describe('every anatomy that prints the cron names its absent executor', () => {
  const ASSERTS_EXECUTION = [
    /runs itself/i,
    /it will run/i,
    /next run/i,
    /\bscheduled\b/i,
  ];

  for (const side of ['left', 'right'] as const) {
    it(`${side === 'left' ? 'map' : 'chart'} — states the declaration and never an execution`, async () => {
      serve(RESPONSE);
      const { container } = render(
        <I18nProvider locale="en">
          <JobDrawer slug="sales/account-enrichment" side={side} open onClose={() => undefined} />
        </I18nProvider>,
      );
      await screen.findByText('Account Enrichment');
      // The expression itself is on screen in both — otherwise this suite would pass on a
      // drawer that simply stopped mentioning the schedule, which proves nothing.
      await waitFor(() => expect(container.textContent).toContain('every Monday at 06:00'));

      const text = container.textContent ?? '';
      for (const claim of ASSERTS_EXECUTION) {
        expect(text, `${side} anatomy asserts an execution: ${String(claim)}`).not.toMatch(claim);
      }
      expect(text.toLowerCase()).toContain('nothing in this build acts on that');
    });
  }
});
