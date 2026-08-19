/**
 * REQ-DRW-A11Y-REVIEW — the review screen is a modal, so it must behave like one.
 *
 * `.review` is `position: absolute; inset: 0` on `--screen`: opaque, full-bleed, over the
 * whole drawer panel. For the whole of M17 wave 2 the focus trap was keyed on the drawer's
 * `open` and knew nothing about `reviewing`, which produced two keyboard-only defects that
 * a screenshot cannot show — focus never entered the review, and everything behind it
 * stayed tabbable.
 *
 * Every assertion here is about **where focus actually lands**, not about which props were
 * passed. A pin comparing two declarations is satisfiable by a lie; `document.activeElement`
 * is not.
 *
 * ## What this suite cannot see
 *
 * - jsdom does not implement `inert`, and it does not move focus on Tab. So what is proven
 *   is *our* trap's behaviour — the list it cycles and where it sends focus at a boundary —
 *   and not the browser's native handling. That is the correct split: `focusables()` has to
 *   agree with the browser, and the way it disagreed is exactly what this suite pins.
 * - It renders the default locale only, and nothing here lays out.
 *
 * Owner: drawer-engineer
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { WorkProductSummary } from '@agnetos/contracts';
import { I18nProvider, en } from '@/i18n';
import { focusables } from '../a11y/focus-trap';
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
  inputs: [{ key: 'account_url', label: 'Account website', type: 'url', required: true }],
};

const ROW: WorkProductSummary = {
  runId: 'run-1',
  agent: 'sales/account-enrichment',
  threadId: 'thread-1',
  branch: 'agnetos/run/run-1',
  baseSha: 'aaaaaaa',
  headSha: 'bbbbbbb',
  commits: 1,
  filesChanged: 1,
  insertions: 2,
  deletions: 1,
  pushState: 'local',
  pushCheckedAt: '2026-08-19T11:56:00.000Z',
  prUrl: null,
  prState: null,
  ciState: null,
  testsRun: null,
  testsPassed: null,
  diffAvailable: true,
  createdAt: '2026-08-19T11:56:00.000Z',
};

const PAGE = {
  runId: 'run-1',
  headSha: 'bbbbbbb',
  totalFiles: 1,
  nextCursor: null,
  files: [
    {
      oldPath: 'src/a.ts',
      newPath: 'src/a.ts',
      status: 'modified',
      insertions: 1,
      deletions: 1,
      hunks: [
        {
          header: '@@ -1,2 +1,2 @@',
          oldStart: 1,
          oldCount: 2,
          newStart: 1,
          newCount: 2,
          lines: [
            { origin: '+', text: 'const b = 2;' },
            { origin: '-', text: 'const a = 1;' },
          ],
        },
      ],
      truncated: false,
      linesWithheld: 0,
    },
  ],
};

function serve(): void {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      const body = url.includes('/diff')
        ? PAGE
        : url.includes('/work-products')
          ? { workProducts: [ROW], reviewQueue: false }
          : url.includes('/metrics/runs')
            ? { runs: [] }
            : url === '/api/status'
              ? { runnerConfigured: false }
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

/** Opens the drawer, waits for the roster, clicks `Review this change`. */
async function openReview() {
  serve();
  render(
    <I18nProvider locale="en">
      <JobDrawer slug="sales/account-enrichment" open onClose={() => undefined} />
    </I18nProvider>,
  );
  await screen.findByText('Account Enrichment');
  const pill = await screen.findByRole('button', { name: en['work.review.open'] as string });
  // `fireEvent.click` does not focus in jsdom; a browser focuses a button on pointer-down,
  // and keyboard activation is focused by definition. Focusing first is what makes this the
  // real journey rather than a click from nowhere — and "focus returns to the control that
  // opened it" is only a meaningful claim if something opened it *with* focus.
  pill.focus();
  fireEvent.click(pill);
  const review = await screen.findByTestId('diff-review');
  await waitFor(() => expect(review.textContent).toContain('src/a.ts'));
  return { review, pill };
}

describe('the review screen takes focus and keeps it', () => {
  it('moves focus into the review when it opens, instead of leaving it on a pill behind it', async () => {
    const { review, pill } = await openReview();

    await waitFor(() => expect(review.contains(document.activeElement)).toBe(true));
    // The precise failure this replaces: focus stayed on the control that opened the
    // review, which is now behind an opaque panel with no focus ring visible anywhere.
    expect(document.activeElement).not.toBe(pill);
  });

  /**
   * The boundary, which is the arithmetic `useFocusTrap` exists to get right.
   *
   * The review is last in the panel's DOM order, so its final control is also the panel
   * trap's final item. Before the fix the trap's list began with the drawer's own close
   * button and the roster's chips, so wrapping forward off the end of the review landed on
   * a control **behind** the opaque overlay. Now the body is `inert` and the list is the
   * review's own controls, so it wraps to the top of the review.
   */
  it('wraps forward off its last control to its own first control, never to one behind it', async () => {
    const { review } = await openReview();

    const inReview = Array.from(
      review.querySelectorAll<HTMLElement>('button:not([disabled]), textarea, a[href]'),
    );
    expect(inReview.length).toBeGreaterThan(1);

    const last = inReview[inReview.length - 1];
    last.focus();
    expect(document.activeElement).toBe(last);

    fireEvent.keyDown(document, { key: 'Tab' });

    expect(review.contains(document.activeElement)).toBe(true);
    expect(document.activeElement).toBe(inReview[0]);
  });

  /**
   * Focus that arrives behind the overlay — a stray programmatic focus, a browser that does
   * not honour `inert`, a restored scroll position — must not be allowed to rest there.
   */
  it('refuses to let focus rest on a control behind the overlay', async () => {
    const { review } = await openReview();

    const behind = screen.getByRole('button', { name: en['work.filter.all'] as string });
    expect(review.contains(behind)).toBe(false);

    behind.focus();
    fireEvent.keyDown(document, { key: 'Tab' });

    expect(review.contains(document.activeElement)).toBe(true);
  });

  /**
   * The half the two traps cannot prove on their own, and the reason `inert` is on the
   * drawer body rather than just `aria-hidden`.
   *
   * Both traps only intercept Tab **at a boundary** — inside the trap the browser's own tab
   * order is deliberately left alone, which is right, and which means every control the
   * browser can still reach is a control the keyboard will walk through. So the property
   * that actually has to hold is a set membership one: *nothing behind the overlay is
   * focusable at all*. `focusables()` is the instrument both traps cycle and the one that
   * has to agree with the browser, so it is asked here directly, against the real DOM.
   *
   * What this cannot see: jsdom implements neither `inert` nor Tab navigation, so the
   * browser's own agreement with `focusables()` is asserted nowhere in this repo. That is
   * the residual risk and it is named rather than papered over.
   */
  it('leaves nothing behind the overlay focusable — the whole panel resolves to the review', async () => {
    const { review } = await openReview();

    const panel = screen.getByRole('dialog');
    const reachable = focusables(panel);
    expect(reachable.length).toBeGreaterThan(1);

    const behind = reachable.filter((el) => !review.contains(el));
    expect(behind.map((el) => el.textContent?.trim() || el.tagName)).toEqual([]);
  });

  it('gives focus back to the control that opened it when Esc closes the review', async () => {
    const { review, pill } = await openReview();
    await waitFor(() => expect(review.contains(document.activeElement)).toBe(true));

    fireEvent.keyDown(document, { key: 'Escape' });

    // The drawer is still open — Esc closed the topmost layer only.
    await waitFor(() => expect(review.getAttribute('data-state')).toBe('closed'));
    expect(screen.getByTestId('job-drawer').getAttribute('data-state')).toBe('open');
    await waitFor(() => expect(document.activeElement).toBe(pill));
  });
});
