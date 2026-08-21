/**
 * REQ-DRW-FAILURE-LEAD — the sentence over a failed list describes what happened to it.
 *
 * ## The defect
 *
 * `LAST RUNS` and `WORK PRODUCTS` both opened every failure with *"could not reach the
 * runner"*. On this build the runner **answers**:
 *
 *   - `GET /api/p/:project/metrics/runs` → **503 `metrics_unavailable`**, because the rule is
 *     that a count the runner cannot read is `null` and every metrics route but the ticker
 *     refuses (api-contracts.md);
 *   - `GET /api/p/:project/work-products` → **503 `thread_store_unavailable`**, because
 *     `requireThreadStore` fronts it and `--profile dev` has no Postgres by design.
 *
 * So the drawer asserted a network fault and then printed the runner's own contradicting
 * sentence directly underneath it, sending a reader to spend an hour on a working network.
 *
 * ## The part that is worse than the wording
 *
 * Because every failure took that one branch, **the two honest empty states had never been on
 * a screen**: *"No runs yet. The first ▶ Run now writes the first row here."* and `work.empty`.
 * Fixing the branch does not make them reachable — that needs a ledger that answers — so the
 * last describe here drives them deliberately. They are proved to exist and to say the right
 * thing; they are still not something anybody has seen, and the handoff says so rather than
 * counting them as shipped.
 *
 * ## The rule this suite also guards
 *
 * **A 503 is never an empty list.** `metrics_unavailable` says the ledger could not be read,
 * and rendering that as "no runs yet" is the plausible zero that api-contracts.md records
 * costing a whole session. Every refusal case below asserts the empty sentence is absent.
 *
 * Both anatomies, one list — `side` is a prop with two values and a suite that drives one of
 * them is an include-list.
 *
 * Owner: drawer-engineer · Consumes: comms/contracts/api-contracts.md (ledger + error table)
 */

import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { en, I18nProvider } from '@/i18n';
import { JobDrawer } from '../JobDrawer';
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
};

const AGENT = {
  slug: 'sales/account-enrichment',
  path: 'agents/sales/account-enrichment/SKILL.md',
  sourceRef: null,
  frontmatter: FRONTMATTER,
  body: '',
  runnable: { tools: [], missingConnectors: [], approvalRequired: false, scheduled: false },
};

/** The runner's real 503 bodies, quoted from the routes that send them. */
const METRICS_503 = {
  error: {
    code: 'metrics_unavailable',
    message: 'This runner has no run ledger configured.',
    hint: 'Start the stack with the full profile and the ledger fills in.',
  },
};
const THREADS_503 = {
  error: {
    code: 'thread_store_unavailable',
    message: 'This runner has no thread store.',
    hint: 'Threads live in Postgres and this runner is not connected to one.',
  },
};

type Answer = { status: number } | 'throw';

function serve(lists: Answer): void {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/work-products') || url.includes('/metrics/runs')) {
        if (lists === 'throw') throw new TypeError('Failed to fetch');
        const body = url.includes('/work-products')
          ? lists.status === 200
            ? { workProducts: [], reviewQueue: false }
            : THREADS_503
          : lists.status === 200
            ? { runs: [] }
            : METRICS_503;
        return new Response(JSON.stringify(body), {
          status: lists.status,
          headers: { 'content-type': 'application/json' },
        });
      }
      const body = url === '/api/status' ? { runnerConfigured: false } : AGENT;
      return new Response(JSON.stringify(body), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }),
  );
}

afterEach(() => vi.unstubAllGlobals());

async function draw(side: 'left' | 'right', lists: Answer): Promise<HTMLElement> {
  serve(lists);
  const { container } = render(
    <I18nProvider locale="en">
      <JobDrawer slug="sales/account-enrichment" side={side} open onClose={() => undefined} />
    </I18nProvider>,
  );
  await screen.findByText('Account Enrichment');
  return container as HTMLElement;
}

const ANATOMIES = [
  { side: 'left', name: 'map (§2.3)' },
  { side: 'right', name: 'chart (§2.6.5)' },
] as const;

describe('a runner that answered is never reported as a runner that did not', () => {
  for (const { side, name } of ANATOMIES) {
    it(`${name} — a 503 with a code leads with "answered", not "could not reach"`, async () => {
      const container = await draw(side, { status: 503 });
      await waitFor(() =>
        expect(container.textContent).toContain('This runner has no run ledger configured.'),
      );

      const text = container.textContent ?? '';
      // Both sections refused, both with the runner's own words under the right lead-in.
      expect(text).toContain('This runner has no thread store.');
      expect(text).toContain(en['drawer.failure.refused']);
      // The sentence that shipped, and the whole finding.
      expect(text).not.toContain(en['drawer.failure.unreachable']);
      expect(text).not.toContain('Couldn’t reach the runner');
    });

    it(`${name} — a 503 is not rendered as an empty list`, async () => {
      const container = await draw(side, { status: 503 });
      await waitFor(() => expect(container.textContent).toContain(en['drawer.failure.refused']));

      const text = container.textContent ?? '';
      // The plausible zero rule 9 exists to refuse. "We could not read the ledger" and
      // "nothing has ever run" were the same bytes once, and it cost a session.
      expect(text).not.toContain('No runs yet');
      expect(text).not.toContain(en['work.empty']);
    });

    it(`${name} — a transport failure still leads with "could not reach"`, async () => {
      const container = await draw(side, 'throw');
      await waitFor(() => expect(container.textContent).toContain(en['drawer.failure.unreachable']));

      const text = container.textContent ?? '';
      // Nothing answered, so nothing may be quoted as having answered.
      expect(text).not.toContain(en['drawer.failure.refused']);
      expect(text).not.toContain('This runner has no run ledger configured.');
    });

    /**
     * The two sentences that have never been on a screen, driven on purpose.
     *
     * This does not make them reachable on the running stack — that needs a Postgres that
     * answers 200 — and nothing here should be read as saying it does. What it does is prove
     * they exist, that they are what a person sees the day the ledger is up, and that a
     * future refactor cannot quietly route a 503 into them.
     */
    it(`${name} — an answered, genuinely empty list gets the honest empty sentence`, async () => {
      const container = await draw(side, { status: 200 });
      await waitFor(() => expect(container.textContent).toContain('No runs yet'));

      const text = container.textContent ?? '';
      expect(text).toContain('The first ▶ Run now writes the first row here.');
      expect(text).toContain(en['work.empty']);
      expect(text).not.toContain(en['drawer.failure.unreachable']);
      expect(text).not.toContain(en['drawer.failure.refused']);
    });
  }
});
