/** @vitest-environment jsdom */
import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { Card } from './Card';

describe('Card (§1.5)', () => {
  it('is a 1px --line hairline over --card, radius in the 12–16px range', () => {
    const { container } = render(<Card>body</Card>);
    const cls = container.firstElementChild!.className;
    expect(cls).toContain('border-line');
    expect(cls).toContain('bg-card');
    expect(cls).toMatch(/rounded-card(-sm|-lg)?\b/);
  });

  it('raises to --card-2 and --line-2 only when interactive', () => {
    const { container: plain } = render(<Card>a</Card>);
    expect(plain.firstElementChild!.className).not.toContain('hover:bg-card-2');

    const { container: live } = render(<Card interactive>b</Card>);
    const cls = live.firstElementChild!.className;
    expect(cls).toContain('hover:bg-card-2');
    expect(cls).toContain('hover:border-line-2');
  });

  it('has no shadow — dark mode shadows are drawers only', () => {
    const { container } = render(<Card interactive>c</Card>);
    expect(container.firstElementChild!.className).not.toContain('shadow');
  });

  it('exposes all three radii from the §1.5 range', () => {
    for (const [radius, cls] of [
      ['sm', 'rounded-card-sm'],
      ['md', 'rounded-card'],
      ['lg', 'rounded-card-lg'],
    ] as const) {
      const { container } = render(<Card radius={radius}>x</Card>);
      expect(container.firstElementChild!.className).toContain(cls);
    }
  });
});
