/** @vitest-environment jsdom */
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Eyebrow } from './Eyebrow';

describe('Eyebrow (§1.4 wide-tracked caps)', () => {
  it('is uppercase and tracked in the +0.25em…+0.45em band', () => {
    render(<Eyebrow>Paid acquisition</Eyebrow>);
    const cls = screen.getByText('Paid acquisition').className;
    expect(cls).toContain('uppercase');
    expect(cls).toMatch(/tracking-wider-[1-4]/);
  });

  it('sm is the shell eyebrow: 10px at +0.35em (§2.0 NAVIGATION)', () => {
    render(<Eyebrow size="sm">Navigation</Eyebrow>);
    const cls = screen.getByText('Navigation').className;
    expect(cls).toContain('text-label-sm');
    expect(cls).toContain('tracking-wider-3');
  });

  it('is monochrome unless the label is about something alive', () => {
    render(<Eyebrow>Departments</Eyebrow>);
    expect(screen.getByText('Departments').className).toContain('text-ink-2');

    render(
      <Eyebrow tone="alive" size="sm">
        Navigation
      </Eyebrow>,
    );
    expect(screen.getByText('Navigation').className).toContain('text-ink-copper-2');
  });

  it('serif variant is italic — the brand signature, never body copy', () => {
    render(<Eyebrow serif>Command center</Eyebrow>);
    const cls = screen.getByText('Command center').className;
    expect(cls).toContain('font-serif');
    expect(cls).toContain('italic');
  });
});
