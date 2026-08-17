/** @vitest-environment jsdom */
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { SegmentedControl } from './SegmentedControl';

const TABS = [
  { value: 'map', label: 'MAP' },
  { value: 'dashboards', label: 'DASHBOARDS' },
  { value: 'chart', label: 'CHART' },
  { value: 'sessions', label: 'SESSIONS' },
] as const;

function setup(value: (typeof TABS)[number]['value'] = 'map', dir: 'ltr' | 'rtl' = 'ltr') {
  const onChange = vi.fn();
  render(
    <div dir={dir}>
      <SegmentedControl options={TABS} value={value} onChange={onChange} label="Views" />
    </div>,
  );
  return { onChange };
}

describe('SegmentedControl (§2.0)', () => {
  it('is a named tablist', () => {
    setup();
    expect(screen.getByRole('tablist', { name: 'Views' })).toBeTruthy();
    expect(screen.getAllByRole('tab')).toHaveLength(4);
  });

  it('active tab is the ivory pill with --copper-ink text', () => {
    setup('chart');
    const cls = screen.getByRole('tab', { name: 'CHART' }).className;
    expect(cls).toContain('bg-copper');
    expect(cls).toContain('text-copper-ink');
    expect(cls).toContain('rounded-pill');
  });

  it('inactive tabs are --ink-2', () => {
    setup('chart');
    const cls = screen.getByRole('tab', { name: 'MAP' }).className;
    expect(cls).toContain('text-ink-2');
    expect(cls).not.toContain('bg-copper');
  });

  it('labels are 11px uppercase at +0.25em', () => {
    setup();
    const cls = screen.getByRole('tab', { name: 'MAP' }).className;
    expect(cls).toContain('text-label');
    expect(cls).toContain('uppercase');
    expect(cls).toContain('tracking-wider-1');
  });

  it('moves selection with the arrow keys and roves tabindex', () => {
    const { onChange } = setup('map');
    const first = screen.getByRole('tab', { name: 'MAP' });
    expect(first.getAttribute('tabindex')).toBe('0');
    expect(screen.getByRole('tab', { name: 'CHART' }).getAttribute('tabindex')).toBe('-1');

    fireEvent.keyDown(first, { key: 'ArrowRight' });
    expect(onChange).toHaveBeenCalledWith('dashboards');

    fireEvent.keyDown(first, { key: 'ArrowLeft' });
    expect(onChange).toHaveBeenCalledWith('sessions'); // wraps
  });

  it('reports the selected tab to assistive tech', () => {
    setup('dashboards');
    expect(
      screen.getByRole('tab', { name: 'DASHBOARDS' }).getAttribute('aria-selected'),
    ).toBe('true');
  });
});

/**
 * The shell's primary navigation, in the second of the two directions the product ships in.
 *
 * This suite exists because of a specific failure, and it is the same one `DepartmentTabs`
 * had: `ArrowRight` mapped to `+1` unconditionally. The tablist is an `inline-flex` row, so
 * `dir="rtl"` reverses it and MAP sits at the far *right* — but the handler did not reverse
 * with it, so ArrowRight walked towards the tab the reader could see on their left. That has
 * been true of MAP · DASHBOARDS · CHART · SESSIONS since the control was written.
 *
 * It stayed green because the suite above renders LTR only. **A check that has never been
 * run in one of the two directions is not a check** — which is why these cases were run
 * against the pre-fix handler and confirmed red before the fix was written.
 *
 * `MIRRORS['shell.segmentedControl']` (i18n/direction.ts) is the governing rule and names
 * this exact control: *"§2.0 — tab order is reading order."*
 */
describe('SegmentedControl keyboard — RTL (§2.0, MIRRORS[shell.segmentedControl])', () => {
  it('ArrowLeft moves to the NEXT tab, because the row is reversed', () => {
    const { onChange } = setup('dashboards', 'rtl');
    // DASHBOARDS is drawn with CHART to its LEFT under dir="rtl", so the key that reaches
    // CHART is ArrowLeft. Pre-fix this selected 'map'.
    fireEvent.keyDown(screen.getByRole('tab', { name: 'DASHBOARDS' }), { key: 'ArrowLeft' });
    expect(onChange).toHaveBeenCalledWith('chart');
  });

  it('ArrowRight moves to the PREVIOUS tab', () => {
    const { onChange } = setup('dashboards', 'rtl');
    fireEvent.keyDown(screen.getByRole('tab', { name: 'DASHBOARDS' }), { key: 'ArrowRight' });
    expect(onChange).toHaveBeenCalledWith('map');
  });

  it('wraps along the list, not along the screen', () => {
    // The wrap is the edge the LTR suite already covers in one direction only, and it is
    // where an off-by-a-sign fix would still be wrong: from MAP, going *back* in reading
    // order must reach SESSIONS in both directions.
    const { onChange } = setup('map', 'rtl');
    fireEvent.keyDown(screen.getByRole('tab', { name: 'MAP' }), { key: 'ArrowRight' });
    expect(onChange).toHaveBeenCalledWith('sessions');
  });

  it('moves DOM focus with the selection, so the roving tab stop is not stranded', () => {
    setup('map', 'rtl');
    fireEvent.keyDown(screen.getByRole('tab', { name: 'MAP' }), { key: 'ArrowLeft' });
    expect(document.activeElement?.textContent).toBe('DASHBOARDS');
  });

  it('reads the direction from the rendered tree, not from a locale', () => {
    // §2.5 and §3.1 both put an LTR island inside the RTL page, so a control rendered in
    // one must key LTR. Nesting is the cheapest proof that `closest('[dir]')` does the
    // work — and `useI18n()` could not be the source here anyway: it throws outside its
    // provider and would take every bare-render suite down.
    const onChange = vi.fn();
    render(
      <div dir="rtl">
        <div dir="ltr">
          <SegmentedControl options={TABS} value="dashboards" onChange={onChange} label="Nested" />
        </div>
      </div>,
    );
    const tablist = screen.getByRole('tablist', { name: 'Nested' });
    fireEvent.keyDown(within(tablist).getByRole('tab', { name: 'DASHBOARDS' }), {
      key: 'ArrowRight',
    });
    expect(onChange).toHaveBeenCalledWith('chart');
  });

  it('Home and End are ordinal, not directional — they do not mirror', () => {
    // The half that is easy to over-apply. Home means "the first tab", which is MAP in
    // both directions; it does not mean "the tab at the leading edge of the screen".
    // Flipping these would be a second bug, not a completion of the fix.
    const { onChange } = setup('chart', 'rtl');
    const tab = screen.getByRole('tab', { name: 'CHART' });
    fireEvent.keyDown(tab, { key: 'Home' });
    expect(onChange).toHaveBeenCalledWith('map');
    fireEvent.keyDown(tab, { key: 'End' });
    expect(onChange).toHaveBeenCalledWith('sessions');
  });

  it('leaves non-arrow keys to bubble, so Tab still leaves the control', () => {
    const { onChange } = setup('map', 'rtl');
    const event = fireEvent.keyDown(screen.getByRole('tab', { name: 'MAP' }), { key: 'Tab' });
    expect(onChange).not.toHaveBeenCalled();
    expect(event).toBe(true); // not defaultPrevented
  });
});
