/** @vitest-environment jsdom */

/**
 * §2.6.1 tab bar — the keyboard, in both directions the product ships in.
 *
 * This suite exists because of a specific failure. REQ-CHT-04 ("roving tabindex, ← →
 * move between departments") was verified *manually*, and the manual pass had only ever
 * been run LTR. `step()` mapped `ArrowRight` to `+1` unconditionally, so under `dir="rtl"`
 * — where the flex row reverses and Sales sits at the far right — the arrows ran backwards
 * for every Arabic reader, at seven tabs. A check that has never been run in one of the two
 * directions is not a check, so REQ-CHT-04's verification is now this file.
 *
 * The RTL cases are therefore written first and asserted on *both* keys, including the
 * edge: an arrow that does nothing at the end of the bar is the other half of the same
 * behaviour, and the pre-fix code would have passed a test that only checked one key moved.
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DepartmentTabs } from './DepartmentTabs';

/** Three is enough to have a middle, a start and an end; the real list is ADR-001's. */
const TABS = [
  { slug: 'sales', label: 'Sales' },
  { slug: 'deals', label: 'Deals' },
  { slug: 'marketing', label: 'Marketing' },
];

function setup(active: string, dir: 'ltr' | 'rtl') {
  const onSelect = vi.fn();
  render(
    <div dir={dir}>
      <DepartmentTabs departments={TABS} active={active} onSelect={onSelect} />
    </div>,
  );
  return { onSelect, tablist: screen.getByRole('tablist', { name: 'Departments' }) };
}

describe('<DepartmentTabs> keyboard — LTR (REQ-CHT-04)', () => {
  it('ArrowRight moves to the next department, ArrowLeft to the previous', () => {
    const { onSelect, tablist } = setup('deals', 'ltr');

    fireEvent.keyDown(tablist, { key: 'ArrowRight' });
    expect(onSelect).toHaveBeenCalledWith('marketing');

    fireEvent.keyDown(tablist, { key: 'ArrowLeft' });
    expect(onSelect).toHaveBeenCalledWith('sales');
  });

  it('holds at the ends instead of wrapping', () => {
    const { onSelect, tablist } = setup('sales', 'ltr');
    fireEvent.keyDown(tablist, { key: 'ArrowLeft' });
    expect(onSelect).not.toHaveBeenCalled();
  });
});

describe('<DepartmentTabs> keyboard — RTL (REQ-CHT-47)', () => {
  it('ArrowLeft moves to the NEXT department, because the row is reversed', () => {
    const { onSelect, tablist } = setup('deals', 'rtl');

    // Under dir="rtl" the flex row runs right-to-left: Marketing is drawn to the LEFT of
    // Deals, so the key that reaches it is ArrowLeft. Pre-fix this selected 'sales'.
    fireEvent.keyDown(tablist, { key: 'ArrowLeft' });
    expect(onSelect).toHaveBeenCalledWith('marketing');
  });

  it('ArrowRight moves to the PREVIOUS department', () => {
    const { onSelect, tablist } = setup('deals', 'rtl');
    fireEvent.keyDown(tablist, { key: 'ArrowRight' });
    expect(onSelect).toHaveBeenCalledWith('sales');
  });

  it('holds at the reading-order end: ArrowRight on the first tab does nothing', () => {
    const { onSelect, tablist } = setup('sales', 'rtl');
    fireEvent.keyDown(tablist, { key: 'ArrowRight' });
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('reads the direction from the rendered tree, not from a locale', () => {
    // The bar keys LTR inside an LTR island even on an RTL page (§2.5, §3.1 both put one
    // there). Nesting is the cheapest proof that `closest('[dir]')` is doing the work.
    const onSelect = vi.fn();
    render(
      <div dir="rtl">
        <div dir="ltr">
          <DepartmentTabs departments={TABS} active="deals" onSelect={onSelect} />
        </div>
      </div>,
    );
    fireEvent.keyDown(screen.getByRole('tablist', { name: 'Departments' }), {
      key: 'ArrowRight',
    });
    expect(onSelect).toHaveBeenCalledWith('marketing');
  });
});

describe('<DepartmentTabs> roving tabindex (REQ-CHT-04)', () => {
  it('exposes exactly one tab stop and moves focus with the selection', () => {
    const { tablist } = setup('deals', 'rtl');
    const tabs = screen.getAllByRole('tab');
    expect(tabs.filter((t) => t.getAttribute('tabindex') === '0')).toHaveLength(1);
    expect(screen.getByRole('tab', { name: 'Deals' }).getAttribute('tabindex')).toBe('0');

    fireEvent.keyDown(tablist, { key: 'ArrowLeft' });
    // The handler moves DOM focus itself; without it the roving stop would be stranded on
    // a tab that is no longer selected.
    expect(document.activeElement?.id).toBe('chart-tab-marketing');
  });

  it('leaves non-arrow keys to bubble (Tab must still leave the bar)', () => {
    const { onSelect, tablist } = setup('deals', 'ltr');
    const event = fireEvent.keyDown(tablist, { key: 'Tab' });
    expect(onSelect).not.toHaveBeenCalled();
    expect(event).toBe(true); // not defaultPrevented
  });
});

describe('<DepartmentTabs> dimming is a claim (REQ-CHT-05)', () => {
  it('dims a department with zero jobs and still renders it, in order', () => {
    render(<DepartmentTabs departments={TABS} active="sales" onSelect={vi.fn()} counts={{ sales: 3 }} />);
    expect(screen.getAllByRole('tab').map((t) => t.textContent)).toEqual([
      'Sales',
      'Deals',
      'Marketing',
    ]);
    expect(screen.getByRole('tab', { name: 'Deals' }).className).toContain('text-ink-3');
  });

  it('dims nothing when counts are absent, because unknown is not zero', () => {
    render(<DepartmentTabs departments={TABS} active="sales" onSelect={vi.fn()} />);
    expect(screen.getByRole('tab', { name: 'Deals' }).className).not.toContain('text-ink-3');
  });
});
