/** @vitest-environment jsdom */
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { SegmentedControl } from './SegmentedControl';

const TABS = [
  { value: 'map', label: 'MAP' },
  { value: 'dashboards', label: 'DASHBOARDS' },
  { value: 'chart', label: 'CHART' },
  { value: 'sessions', label: 'SESSIONS' },
] as const;

function setup(value: (typeof TABS)[number]['value'] = 'map') {
  const onChange = vi.fn();
  render(
    <SegmentedControl options={TABS} value={value} onChange={onChange} label="Views" />,
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
