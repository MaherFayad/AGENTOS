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

  it('is the widest tracking rung, and the silent case is the legible one', () => {
    render(<RailLabel>Operations</RailLabel>);
    const cls = screen.getByText('Operations').className;
    expect(cls).toContain('tracking-wider-4');
    expect(cls).toContain('uppercase');
    // Ruled 2026-08-16 (tokens contract §9.7). The default was `faint` = --ink-3, which
    // fails AA on every surface in both themes (§9.1) and was inherited into two shipped
    // rails that nobody could grep for. A default prop is a token spent at a call site that
    // never mentions it, so the token spent in silence has to be the safe one.
    expect(cls).toContain('text-ink-2');
    expect(cls).not.toContain('text-ink-3');
  });

  it('still offers faint, but only when a call site asks for it out loud', () => {
    // §9.3 keeps a genuine home for faint — a rail cap that repeats the heading beside it.
    // Flipping the default removed the silent path to it, not the tone.
    render(<RailLabel tone="faint">Redundant</RailLabel>);
    expect(screen.getByText('Redundant').className).toContain('text-ink-3');
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
