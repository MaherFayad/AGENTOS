/** @vitest-environment jsdom */
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Pill } from './Pill';

describe('Pill (§1.5)', () => {
  it('is always fully round', () => {
    render(<Pill>Run now</Pill>);
    expect(screen.getByRole('button').className).toContain('rounded-pill');
  });

  it('primary is --copper on --copper-ink at 13px/600', () => {
    render(<Pill variant="primary">Book a call</Pill>);
    const cls = screen.getByRole('button').className;
    expect(cls).toContain('bg-copper');
    expect(cls).toContain('text-copper-ink');
    expect(cls).toContain('text-pill'); // 13px / 600
  });

  it('secondary is transparent with a 1px --line-2 border', () => {
    render(<Pill variant="secondary">Feedback</Pill>);
    const cls = screen.getByRole('button').className;
    expect(cls).toContain('bg-transparent');
    expect(cls).toContain('border-line-2');
    expect(cls).not.toContain('bg-copper');
  });

  it('square sm is the 32px shell control (§2.0)', () => {
    render(
      <Pill variant="ghost" square aria-label="Fullscreen">
        {'⛶'}
      </Pill>,
    );
    const cls = screen.getByRole('button').className;
    expect(cls).toContain('h-8');
    expect(cls).toContain('w-8');
  });

  it('defaults to type=button so a pill inside a form never submits it', () => {
    render(<Pill>Zoom in</Pill>);
    expect(screen.getByRole('button').getAttribute('type')).toBe('button');
  });

  it('carries no color literal in its class list', () => {
    render(<Pill variant="primary">x</Pill>);
    expect(screen.getByRole('button').className).not.toMatch(/#[0-9a-fA-F]{3,8}|rgba?\(/);
  });
});
