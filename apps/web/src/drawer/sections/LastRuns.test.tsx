/**
 * REQ-DRW-A11Y — LAST RUNS status is never colour-only, in either row branch.
 *
 * The §2.3 row communicates status with a 6px data-ink dot (§1.3 — status is a value, so it
 * gets colour). WCAG 1.4.1 says colour may not be the *only* carrier. The regression this
 * suite exists to stop is specific and was shipped once: the word lived in a `title` on the
 * row wrapper, and with `LANGFUSE_*` unset every row takes the **non-link** `<span>` branch,
 * which is not focusable and whose `title` no screen reader reliably announces.
 *
 * So each case is asserted against both branches — `traceUrl` present and absent.
 *
 * Owner: drawer-engineer
 */

import { describe, expect, it } from 'vitest';
import type { RunRow } from '../data/types';
import { LastRuns, type RunsState } from './LastRuns';
import { render } from '@testing-library/react';

/**
 * The text an assistive technology reads in browse mode: every text node **except** those
 * inside an `aria-hidden="true"` subtree. This is deliberately not `textContent` — a test
 * that used `textContent` would have passed against the broken version, because the dot's
 * `data-status` attribute and the wrapper's `title` are both invisible to it either way.
 */
function accessibleText(root: Element): string {
  const walker = root.ownerDocument.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      for (let el = node.parentElement; el && el !== root.parentElement; el = el.parentElement) {
        if (el.getAttribute('aria-hidden') === 'true') return NodeFilter.FILTER_REJECT;
      }
      return NodeFilter.FILTER_ACCEPT;
    },
  });
  const out: string[] = [];
  for (let n = walker.nextNode(); n; n = walker.nextNode()) out.push(n.textContent ?? '');
  return out.join(' ').replace(/\s+/g, ' ').trim();
}

const BASE: RunRow = {
  runId: 'r1',
  startedAt: new Date(Date.now() - 3 * 3600_000).toISOString(),
  status: 'error',
  durationMs: 4200,
  costSource: 'unpriced',
};

const WITH_TRACE: RunRow = { ...BASE, runId: 'r2', traceUrl: 'https://langfuse.example/trace/r2' };

describe('LAST RUNS — status is not colour alone (WCAG 1.4.1)', () => {
  it('exposes the status word as text in the non-link branch — the one that ships today', () => {
    const { container } = render(<LastRuns state={{ kind: 'ready', rows: [BASE] }} />);
    const row = container.querySelector('[title]');

    expect(row).not.toBeNull();
    expect(row!.tagName).toBe('SPAN'); // no traceUrl => the non-focusable branch
    expect(accessibleText(row!)).toContain('failed');
  });

  it('puts the status word in the link branch’s accessible NAME, not just its title', () => {
    const { getByRole } = render(<LastRuns state={{ kind: 'ready', rows: [WITH_TRACE] }} />);

    // `name` here is Testing Library's accessible-name computation (dom-accessibility-api),
    // not a text match — it throws if the name does not contain the word. Name-from-content
    // means the sr-only word is part of the NAME, so it survives an AT that drops `title`
    // as a mere description. Queried by role rather than imported directly so the suite
    // depends only on what `apps/web/package.json` actually declares.
    const link = getByRole('link', { name: /failed/ });
    expect(link).toHaveProperty('href');
    expect(accessibleText(link)).toContain('failed');
  });

  it('carries every status word, both branches, and never leaks the raw enum', () => {
    const statuses: RunRow['status'][] = [
      'queued',
      'ok',
      'error',
      'running',
      'awaiting-approval',
      'denied',
      'canceled',
    ];
    const expected = [
      'queued',
      'finished',
      'failed',
      'running',
      'waiting for approval',
      'denied',
      'canceled',
    ];

    for (const [i, status] of statuses.entries()) {
      for (const traceUrl of [undefined, 'https://langfuse.example/t']) {
        const { container, unmount } = render(
          <LastRuns state={{ kind: 'ready', rows: [{ ...BASE, status, traceUrl }] }} />,
        );
        expect(accessibleText(container)).toContain(expected[i]);
        unmount();
      }
    }

    // 'ok' must read "finished", 'error' must read "failed" — the enum is a wire value.
    const { container } = render(<LastRuns state={{ kind: 'ready', rows: [{ ...BASE, status: 'ok' }] }} />);
    expect(accessibleText(container)).not.toContain('ok');
  });

  it('keeps the dot itself aria-hidden — the fix adds a carrier, it does not double-announce', () => {
    const { container } = render(<LastRuns state={{ kind: 'ready', rows: [BASE] }} />);
    const dot = container.querySelector('[data-status]');

    expect(dot?.getAttribute('aria-hidden')).toBe('true');
    expect(dot?.textContent).toBe('');
  });
});

describe('LAST RUNS — the honest empty states are content, not decoration', () => {
  it('renders a written sentence for each not-yet state rather than a blank or a zero', () => {
    // Annotated rather than `as const` on each element: `as const` makes `rows` a
    // `readonly []`, which is not assignable to `RunsState`'s mutable `RunRow[]`. That was
    // invisible until `tsconfig.test.json` began typechecking the suite.
    const states: RunsState[] = [
      { kind: 'loading' },
      { kind: 'ready', rows: [] },
      { kind: 'failed', message: 'ECONNREFUSED' },
    ];
    for (const state of states) {
      const { container, unmount } = render(<LastRuns state={state} />);
      const p = container.querySelector('p');
      expect(p).not.toBeNull();
      // `.empty`, not a disabled-text class. The colour itself is asserted in CSS review;
      // what is asserted here is that the sentence exists and is a paragraph of prose.
      expect(p!.className).toContain('empty');
      expect(accessibleText(p!).length).toBeGreaterThan(10);
      unmount();
    }
  });
});
