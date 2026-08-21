/**
 * §2.2 rails — the two things about them that a reader can get wrong silently.
 *
 * `src/test/primitive-color-defaults.test.ts` already forbids *inheriting* `RailLabel`'s
 * faint default anywhere in `src/`. That guard is deliberately mechanical: it is satisfied by
 * `tone="faint"` written out loud. This file pins the judgement the generic guard cannot make
 * — that the tone these two sites want is `muted` — and pins the hover repair, which no
 * contrast rule would ever have found.
 *
 * Contract: comms/contracts/design-tokens.md §9.2, §9.3, §9.4a.
 */

import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DepartmentRails } from './DepartmentRails';

const rails = () => {
  render(<DepartmentRails department="design" onPrev={vi.fn()} onNext={vi.fn()} />);
  return screen.getAllByRole('button');
};

describe('DepartmentRails (§2.2)', () => {
  it('names both neighbouring departments to a screen reader and on screen', () => {
    const [prev, next] = rails();
    // The accessible name and the visible text are both present, and they are not the same
    // department — a rail that named the *current* one would be §9.3's blessed carve-out.
    expect(prev.getAttribute('aria-label')).toMatch(/^Slide to \w/);
    expect(next.getAttribute('aria-label')).toMatch(/^Slide to \w/);
    expect(prev.textContent?.replace(/[‹›\s]/g, '')).not.toBe('');
    expect(prev.textContent).not.toBe(next.textContent);
  });

  it('renders the neighbour names at --ink-2, never the faint default', () => {
    // §9.2: required reading is --ink-2 or brighter, and --ink-3 fails AA on every surface in
    // both themes (§9.1). Delete these labels and nothing else on screen says which
    // departments are adjacent, so the "repeats the heading beside it" carve-out cannot apply.
    for (const button of rails()) {
      const label = button.querySelector('.rail-up, .rail-down');
      expect(label).not.toBeNull();
      expect(label!.className).toContain('text-ink-2');
      expect(label!.className).not.toContain('text-ink-3');
    }
  });

  it('lets the button’s hover reach the label and not just the chevron', () => {
    // `RailLabel` sets its own colour class, so it never inherited the button's
    // `hover:text-ivory`: hovering brightened the aria-hidden ‹ › and left the name it points
    // at unchanged. A dead affordance on the one control that is hard to notice at all.
    for (const button of rails()) {
      expect(button.className).toContain('group');
      expect(button.className).toContain('hover:text-ivory');
      const label = button.querySelector('.rail-up, .rail-down')!;
      expect(label.className).toContain('group-hover:text-ivory');
      expect(label.className).toContain('group-focus-visible:text-ivory');
    }
  });
});
