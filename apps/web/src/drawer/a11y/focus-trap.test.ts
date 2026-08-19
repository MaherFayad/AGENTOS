/**
 * REQ-DRW-A11Y — the trap's arithmetic, and the question of what it can *see*.
 *
 * The arithmetic was always tested. What was not, until M17 mounted an `inert` container
 * inside an active trap root, was `focusables()`'s exclusion list: two of its three rules
 * asked the ancestor chain and the third asked the element alone, so a control inside an
 * inert container stayed in the cycle the browser had already dropped it from.
 *
 * ## What this suite cannot see
 *
 * - jsdom implements no layout, so the `display`/`visibility` branch is exercised only
 *   through inline styles, never through a stylesheet.
 * - jsdom does not implement `inert` at all — the browser's own behaviour is not asserted
 *   here, only ours. That is the right split: `focusables()` is the list the trap cycles,
 *   and it must agree with the browser rather than be the browser.
 */

import { describe, expect, it } from 'vitest';
import { focusables, keyIntent, nextIndex } from './focus-trap';

describe('focus-trap arithmetic', () => {
  it('maps Esc to close and Tab to cycle', () => {
    expect(keyIntent({ key: 'Escape', shiftKey: false })).toBe('close');
    expect(keyIntent({ key: 'Tab', shiftKey: false })).toBe('cycle-forward');
    expect(keyIntent({ key: 'Tab', shiftKey: true })).toBe('cycle-back');
    expect(keyIntent({ key: 'Enter', shiftKey: false })).toBeNull();
  });

  it('wraps at both ends and enters from outside at the first / last item', () => {
    expect(nextIndex(-1, 3, false)).toBe(0);
    expect(nextIndex(-1, 3, true)).toBe(2);
    expect(nextIndex(2, 3, false)).toBe(0);
    expect(nextIndex(0, 3, true)).toBe(2);
  });
});

/** Builds `<div id=root>` with a live control, then a container holding two more. */
function tree(containerAttrs: string): HTMLElement {
  const root = document.createElement('div');
  root.innerHTML = `
    <button id="live">live</button>
    <div id="box" ${containerAttrs}>
      <button id="buried">buried</button>
      <textarea id="note"></textarea>
    </div>
  `;
  document.body.append(root);
  return root;
}

describe('focusables sees what the browser sees', () => {
  const ids = (root: HTMLElement) => focusables(root).map((el) => el.id);

  it('counts everything when nothing is excluded', () => {
    expect(ids(tree(''))).toEqual(['live', 'buried', 'note']);
  });

  /**
   * The M17 finding, in one assertion. `inert` on a *container* — which is what
   * `DiffScreen` sets on itself while the review screen is closed — must remove its
   * descendants, not just itself. Before this was `closest('[inert]')`, both buried
   * controls were counted, and the trap's boundary test (`current === items.length - 1`)
   * was measured against two entries no keyboard could ever reach.
   */
  it('drops a control buried inside an inert container, not only an inert control', () => {
    expect(ids(tree('inert'))).toEqual(['live']);
  });

  it('drops one buried under hidden and under aria-hidden too — one rule, three attributes', () => {
    expect(ids(tree('hidden'))).toEqual(['live']);
    expect(ids(tree('aria-hidden="true"'))).toEqual(['live']);
  });

  /**
   * The consequence, asserted rather than described: with an inert container in the tree,
   * the *last* entry must be the last thing a keyboard can actually land on. That index is
   * what `useFocusTrap` compares against to decide whether Tab is leaving the trap, so a
   * phantom tail means the trap declines to intercept at the real boundary.
   */
  it('puts the real last control at the boundary index the trap tests against', () => {
    const root = tree('inert');
    const items = focusables(root);
    expect(items[items.length - 1]?.id).toBe('live');
  });
});
