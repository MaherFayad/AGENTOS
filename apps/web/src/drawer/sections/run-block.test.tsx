/**
 * REQ-DRW-RUN-BLOCK — `▶ Run now` and the form it feeds are next to each other, and a refusal
 * moves the reader to the field it refused.
 *
 * ## The defect
 *
 * `INPUTS` sat **1,375px** below the button that submits it — `▶ Run now` at y=303, the first
 * required field at y=1,678 in an 1,782px scroll body, measured in Chrome at 1440×900 on
 * `/p/agentos/map/sales/account-enrichment`. Nine sections in between. And `onRun`'s failure
 * path wrote field errors with no scroll and no focus move, so on the day the API key lands
 * the flow is: press a button, watch nothing happen, scroll past the ladder to find out why.
 *
 * Spec §2.3 items 1–10 are the video's order and do not move. `INPUTS` is one of *our*
 * additions, so its position was ours to choose — and it was chosen badly.
 *
 * ## Why adjacency is asserted structurally
 *
 * A pixel offset would need layout, which jsdom does not have, and a "y is less than z"
 * assertion in a browser probe would pass with eight sections still in between. So what is
 * asserted is the thing that is actually true and stays true at any viewport: the INPUTS
 * section is the skill-file card's **next element sibling**, in both anatomies. Nothing can be
 * inserted between them without a failure here.
 *
 * ## The instrument caveat
 *
 * The focus assertion is driven by dispatching a real `click` event at the real button and
 * reading `document.activeElement`. It is deliberately not `element.focus()` followed by a
 * check that focus moved, which proves only that `focus()` works — the same class of mistake
 * as reading `outline: none` off a programmatic focus that never matched `:focus-visible`.
 *
 * What this instrument still cannot do is press a physical pointer, and there is no layout
 * here, so **the scroll half is not observed by this suite at all**. That half was taken in
 * headless Chrome at 1440×900 over CDP with `Input.dispatchMouseEvent` at the button's real
 * coordinates: map `scrollTop` 0 → 155 and chart 1,623 → 1,568, focus landing on
 * `#drawer-input-account_url` at y=385 with *"Account website is required."* rendered, in both
 * anatomies. That probe had to answer `/api/status` with `runnerConfigured:true` through a
 * page-level fetch shim, because on the real stack the button is disabled and the path cannot
 * be reached by any gesture at all — which is the honest state of this fix and is in the
 * handoff, not softened here. Two instruments, each asked only for what it can see.
 *
 * Owner: drawer-engineer
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
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
 * Two required fields, both empty, and the first one declared first. `planInputs` keeps
 * frontmatter order because the agent's author chose it, so "the first field that was refused"
 * is a fact about this list and not about `Object.keys`.
 */
const FRONTMATTER: AgentDoc['frontmatter'] = {
  name: 'Account Enrichment',
  department: 'sales',
  cluster: 'enrichment',
  tier: 'autonomous',
  description: 'Layer firmographics onto target accounts.',
  wired_into: ['exa'],
  breaks_into: ['sales/lead-scoring'],
  replaces: 'A junior analyst day per company researched properly.',
  the_human: 'Someone still decides which accounts are worth the money.',
  inputs: [
    { key: 'website', label: 'Account website', type: 'url', required: true },
    { key: 'notes', label: 'Anything else', type: 'textarea', required: true },
  ],
};

const AGENT = {
  slug: 'sales/account-enrichment',
  path: 'agents/sales/account-enrichment/SKILL.md',
  sourceRef: null,
  frontmatter: FRONTMATTER,
  body: '',
  runnable: { tools: [], missingConnectors: [], approvalRequired: false, scheduled: false },
};

function serve(runnerConfigured: boolean): void {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      const body = url.includes('/work-products')
        ? { workProducts: [], reviewQueue: false }
        : url.includes('/metrics/runs')
          ? { runs: [] }
          : url === '/api/status'
            ? { runnerConfigured }
            : AGENT;
      return new Response(JSON.stringify(body), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }),
  );
}

afterEach(() => vi.unstubAllGlobals());

async function draw(side: 'left' | 'right', runnerConfigured: boolean): Promise<HTMLElement> {
  serve(runnerConfigured);
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

describe('the form is next to the button that submits it', () => {
  for (const { side, name } of ANATOMIES) {
    it(`${name} — INPUTS is the skill-file card's immediate next sibling`, async () => {
      const container = await draw(side, false);

      const heading = [...container.querySelectorAll('h3')].find(
        (h) => h.textContent?.trim() === 'Inputs',
      );
      expect(heading, 'the INPUTS section did not render at all').toBeDefined();
      const inputsSection = heading!.closest('section');
      expect(inputsSection).not.toBeNull();

      // The card is not a `Section`; it is the `.skillCard` div carrying `▶ Run now`.
      const runButton = screen.getByRole('button', { name: /Run now/ });
      const card = runButton.closest('div[class*="skillCard"]');
      expect(card, 'the skill-file card could not be found').not.toBeNull();

      expect(card!.nextElementSibling).toBe(inputsSection);
    });

    it(`${name} — nothing from the spec's own order moved to make room`, async () => {
      const container = await draw(side, false);
      const order = [...container.querySelectorAll('h3')].map((h) => h.textContent?.trim());
      // §2.3 items 5–9 on the map, §2.6.5's own list on the chart — INPUTS was inserted, and
      // insertion is the only edit allowed here. A suite that only checked adjacency would
      // pass on a drawer that had reordered the video's sections to get it.
      const spec =
        side === 'left'
          ? ['Breaks into', 'Wired into', 'What it replaces', 'The ladder', 'The human']
          : ['What it replaces', 'What it does', 'From manual to autonomous', 'Skills', 'Tools'];
      const seen = order.filter((label) => label && spec.includes(label));
      expect(seen).toEqual(spec);
    });
  }
});

describe('a refusal moves the reader to the field it refused', () => {
  for (const { side, name } of ANATOMIES) {
    it(`${name} — pressing Run with an empty required field focuses that field`, async () => {
      const container = await draw(side, true);
      fireEvent.click(await screen.findByRole('button', { name: /Run now/ }));

      await waitFor(() => expect(container.textContent).toContain('Account website is required.'));
      // The FIRST refused field in frontmatter order, not whichever key the validator happened
      // to write first. Both fields are refused here.
      await waitFor(() => expect(document.activeElement?.id).toBe('drawer-input-website'));
    });

    /**
     * The assertion that stops the fix being `fields[0]`.
     *
     * The first field is filled and valid; the second is empty. A handler that moved the
     * reader to the top of the form would look identical in the case above and be wrong here —
     * it would land them on a field with no error on it and no explanation of why the button
     * did nothing, which is the original defect with a shorter scroll.
     */
    it(`${name} — it is the refused field, not the first field`, async () => {
      const container = await draw(side, true);
      fireEvent.change(screen.getByLabelText(/Account website/), {
        target: { value: 'https://example.com' },
      });
      fireEvent.click(await screen.findByRole('button', { name: /Run now/ }));

      await waitFor(() => expect(container.textContent).toContain('Anything else is required.'));
      expect(container.textContent).not.toContain('Account website is required.');
      await waitFor(() => expect(document.activeElement?.id).toBe('drawer-input-notes'));
    });
  }
});
