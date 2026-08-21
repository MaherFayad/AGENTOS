/**
 * REQ-DRW-INERT-VISIBLE — a disabled control says why, **on the screen**, in both anatomies.
 *
 * ## The defect
 *
 * Sixteen of eighteen controls on the chart panel were disabled, each carrying a correct,
 * specific, human sentence — in a `title` and a 1×1 `sr-only` span, and nowhere else. That
 * reaches a hovering mouse and a screen reader. It does not reach a phone (§3.6 makes the
 * phone the point of this PWA) and it does not reach a keyboard: `title` does not open on
 * focus in any browser, so the carrier span drew a focus ring and said nothing.
 *
 * ## Why this suite sweeps rather than lists
 *
 * The standing lesson is that **an include-list is a decision to be blind to everything
 * unnamed**, and this repo has paid for it four times — most recently in this very drawer,
 * where a suite written to catch a false schedule claim rendered only `side="left"` and could
 * not see the chart anatomy where the claim actually lived. So nothing here names a control.
 * It finds every disabled control the drawer rendered and asks each one the same question. A
 * nineteenth button added tomorrow is covered on the day it lands.
 *
 * ## What it cannot see, and where that half is done
 *
 * jsdom applies no stylesheet, so "visible" cannot be measured here as geometry. What is
 * measured is the mechanism that made it invisible: the explanation must not be inside an
 * `sr-only` subtree, and it must survive a text walk that drops those subtrees.
 *
 * The geometric half was taken in headless Chrome at 1440×900 over CDP: 3 dead controls on the
 * map and **15 on the chart**, none of them undescribed, every explanation measuring 214–304 ×
 * 33px (the download sentence wraps to 50–66px) at `rgb(132,132,140)` — `--ink-2`, the content
 * grey, not the `--ink-3` used for disabled. Real `Input.dispatchKeyEvent` Tab presses through
 * fourteen stops found **no focus stop on a disabled control**, which is the other half of the
 * fix: the `tabIndex={0}` hover carrier is gone, because a stop whose only observable effect
 * was that it existed is not an accessibility feature.
 *
 * Owner: drawer-engineer
 */

import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { I18nProvider } from '@/i18n';
import { JobDrawer } from '../JobDrawer';
import type { AgentDoc } from '../data/types';

vi.mock('next/navigation', () => ({
  usePathname: () => '/p/agentos/map',
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

/**
 * `breaks_into` carries one entry with a slash and one without, on purpose: `projectAgent`
 * resolves the first to an agent and the second to a leaf file, so the chart's SKILLS group
 * renders one card whose buttons are dead for a **permanent** reason and one whose `▶ Run` is
 * dead only because the runner is down. Collapsing those into one sentence is the mistake this
 * fixture exists to make visible.
 */
const FRONTMATTER: AgentDoc['frontmatter'] = {
  name: 'Account Enrichment',
  department: 'sales',
  cluster: 'enrichment',
  tier: 'autonomous',
  description: 'Layer firmographics onto target accounts.',
  wired_into: ['exa'],
  breaks_into: ['sales/lead-scoring', 'dedupe'],
};

const AGENT = {
  slug: 'sales/account-enrichment',
  path: 'agents/sales/account-enrichment/SKILL.md',
  sourceRef: null,
  frontmatter: FRONTMATTER,
  body: '',
  runnable: { tools: [], missingConnectors: [], approvalRequired: false, scheduled: false },
};

/** The state of this build: the runner is up and holds no API key. */
function serve(): void {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      const body = url.includes('/work-products')
        ? { workProducts: [], reviewQueue: false }
        : url.includes('/metrics/runs')
          ? { runs: [] }
          : url === '/api/status'
            ? { runnerConfigured: false }
            : AGENT;
      return new Response(JSON.stringify(body), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }),
  );
}

afterEach(() => vi.unstubAllGlobals());

/** Every text node except those inside an `sr-only` or `aria-hidden` subtree. */
function visibleText(root: Element): string {
  const walker = root.ownerDocument.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      for (let el = node.parentElement; el && el !== root.parentElement; el = el.parentElement) {
        if (el.getAttribute('aria-hidden') === 'true') return NodeFilter.FILTER_REJECT;
        if (/srOnly|sr-only|visually-?hidden/i.test(el.className)) return NodeFilter.FILTER_REJECT;
        if (el.hasAttribute('inert')) return NodeFilter.FILTER_REJECT;
      }
      return NodeFilter.FILTER_ACCEPT;
    },
  });
  const out: string[] = [];
  for (let n = walker.nextNode(); n; n = walker.nextNode()) out.push(n.textContent ?? '');
  return out.join(' ').replace(/\s+/g, ' ').trim();
}

function isInert(el: Element): boolean {
  for (let node: Element | null = el; node; node = node.parentElement) {
    if (node.hasAttribute('inert')) return true;
  }
  return false;
}

/** Every control a person can see and cannot use. */
function deadControls(panel: Element): HTMLElement[] {
  return [...panel.querySelectorAll<HTMLElement>('button[disabled], [aria-disabled="true"]')].filter(
    (el) => !isInert(el),
  );
}

async function draw(side: 'left' | 'right') {
  serve();
  const { container } = render(
    <I18nProvider locale="en">
      <JobDrawer slug="sales/account-enrichment" side={side} open onClose={() => undefined} />
    </I18nProvider>,
  );
  await screen.findByText('Account Enrichment');
  const panel = container.querySelector('[data-testid="job-drawer"]');
  expect(panel).not.toBeNull();
  // The status probe is a second fetch; without it every control is still in `checking`.
  await waitFor(() => expect(deadControls(panel!).length).toBeGreaterThan(0));
  return panel!;
}

const ANATOMIES = [
  { side: 'left', name: 'map (§2.3)' },
  { side: 'right', name: 'chart (§2.6.5)' },
] as const;

describe('every control that cannot be used says why, in words, on the screen', () => {
  for (const { side, name } of ANATOMIES) {
    it(`${name} — every disabled control resolves to a visible explanation`, async () => {
      const panel = await draw(side);
      const dead = deadControls(panel);
      const shown = visibleText(panel);

      for (const control of dead) {
        const label = control.textContent?.trim() ?? '(unlabelled)';
        const describedBy = control.getAttribute('aria-describedby');
        expect(describedBy, `"${label}" is disabled and describes itself to nobody`).toBeTruthy();

        for (const id of (describedBy ?? '').split(/\s+/).filter(Boolean)) {
          const note = panel.ownerDocument.getElementById(id);
          expect(note, `"${label}" points aria-describedby at #${id}, which is not in the page`)
            .not.toBeNull();
          const text = note!.textContent?.trim() ?? '';
          expect(text.length, `"${label}"'s explanation is empty`).toBeGreaterThan(20);
          // The mechanism that hid sixteen of these. Asserted by class spelling because
          // jsdom has no layout; the geometry was measured in Chrome instead.
          expect(
            /srOnly|sr-only|visually-?hidden/i.test(note!.className),
            `"${label}"'s explanation is still screen-reader-only`,
          ).toBe(false);
          expect(shown, `"${label}"'s explanation is not in the visible text`).toContain(text);
        }
      }
    });

    it(`${name} — the explanation is not the tooltip alone`, async () => {
      const panel = await draw(side);
      const shown = visibleText(panel);
      // Every `title` a disabled control (or its hover carrier) carries must also be readable
      // without hovering. This is the assertion that would have gone red on the shipped build.
      for (const control of deadControls(panel)) {
        const carrier = control.getAttribute('title') ? control : control.parentElement;
        const title = carrier?.getAttribute('title');
        if (!title) continue;
        expect(shown, `a reason readable only on hover: "${title}"`).toContain(title);
      }
    });
  }
});

describe('the chart panel needs two sentences, not one', () => {
  /**
   * `fidelity-qa-reviewer`'s "one shared line per card group" would have been wrong here, and
   * the refinement is the point: three `▶ Run` buttons are dead because a sub-skill is not an
   * agent — a permanent property that never turns on — while `Take it ↓`, `▶ Run now` and
   * `⏰ Schedule` are dead because this runner has no API key. One collapsed line would say
   * "the runner is down" about four buttons that stay disabled with it up.
   */
  it('shows the permanent reason and the build-state reason as separate paragraphs', async () => {
    const panel = await draw('right');
    const shown = visibleText(panel);

    expect(shown).toContain('Only a full agent can be run on its own');
    expect(shown).toContain('has no API key');

    const notes = [...panel.querySelectorAll('p')].map((p) => p.textContent ?? '');
    const permanent = notes.filter((t) => t.includes('Only a full agent can be run on its own'));
    const transient = notes.filter((t) => t.includes('has no API key'));
    expect(permanent.length).toBeGreaterThan(0);
    expect(transient.length).toBeGreaterThan(0);
    // Different paragraphs, so neither can be read as a gloss on the other.
    expect(permanent.some((t) => t.includes('has no API key'))).toBe(false);
  });

  /**
   * F5. Three pills reading HUMAN-LED / HUMAN-ASSISTED / FULLY AUTONOMOUS, all disabled, one
   * styled active — a segmented control that does not respond, and it was the only one of the
   * sixteen with no reason near it at all.
   */
  it('explains the autonomy row, which looks exactly like a working segmented control', async () => {
    const panel = await draw('right');
    const row = panel.querySelector('[role="group"][aria-label="Autonomy state"]');
    expect(row).not.toBeNull();
    const pills = [...row!.querySelectorAll('button')];
    expect(pills).toHaveLength(3);
    for (const pill of pills) expect(pill.disabled).toBe(true);
    expect(visibleText(panel)).toContain('Moving it commits a change to its SKILL.md');
  });
});
