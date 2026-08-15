/** @vitest-environment jsdom */
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RailLabel } from './RailLabel';

describe('RailLabel (§1.4, §2.1)', () => {
  it('rotates through writing-mode, not transform: rotate', () => {
    render(<RailLabel>Growth</RailLabel>);
    const cls = screen.getByText('Growth').className;
    expect(cls).toContain('rail-up');
    expect(cls).not.toMatch(/rotate-90|-rotate-90/);
  });

  it('is the widest tracking rung in --ink-3', () => {
    render(<RailLabel>Operations</RailLabel>);
    const cls = screen.getByText('Operations').className;
    expect(cls).toContain('tracking-wider-4');
    expect(cls).toContain('text-ink-3');
    expect(cls).toContain('uppercase');
  });

  it('spaces itself on the logical inline axis so RTL needs no override', () => {
    render(<RailLabel>Finance</RailLabel>);
    const cls = screen.getByText('Finance').className;
    expect(cls).toContain('ps-3');
    expect(cls).toContain('pe-3');
    expect(cls).not.toMatch(/\bpl-|\bpr-/);
  });

  it('flips reading direction on request', () => {
    render(<RailLabel orientation="down">Sales</RailLabel>);
    expect(screen.getByText('Sales').className).toContain('rail-down');
  });
});
