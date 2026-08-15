/** @vitest-environment jsdom */
/* token-exempt-file: asserts Chip's data-ink class map, which means naming
 * bg-ink-* and border-ink-* out loud. Chip.tsx carries the same exemption. */
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Chip } from './Chip';
import type { ChipTone } from './Chip';

describe('Chip (§1.3, §1.5)', () => {
  it('is 11px with a 1px border and a 6px radius', () => {
    render(<Chip>On track</Chip>);
    const cls = screen.getByText('On track').className;
    expect(cls).toContain('text-chip');
    expect(cls).toContain('rounded-chip');
    expect(cls).toContain('border');
  });

  it('is monochrome by default — no status, no color', () => {
    render(<Chip>Draft</Chip>);
    expect(screen.getByText('Draft').className).not.toMatch(/ink-(teal|coral|amber|blue|lavender|copper)/);
  });

  it('maps each status to its §1.3 data-ink token', () => {
    const cases: [ChipTone, string][] = [
      ['live', 'ink-copper'],
      ['success', 'ink-teal'],
      ['risk', 'ink-coral'],
      ['warn', 'ink-amber'],
      ['info', 'ink-blue'],
      ['demo', 'ink-lavender'],
    ];
    for (const [tone, token] of cases) {
      const { container } = render(<Chip tone={tone}>{tone}</Chip>);
      expect(container.firstElementChild!.className).toContain(`text-${token}`);
      expect(container.firstElementChild!.className).toContain(`border-${token}-line`);
    }
  });

  it('renders the dot in the tone color and hides it from assistive tech', () => {
    const { container } = render(
      <Chip tone="success" dot>
        Healthy
      </Chip>,
    );
    const dot = container.querySelector('[aria-hidden]')!;
    expect(dot.className).toContain('bg-ink-teal');
  });

  it('caps variant is wide-tracked uppercase', () => {
    const { container } = render(<Chip caps>live</Chip>);
    const cls = container.firstElementChild!.className;
    expect(cls).toContain('uppercase');
    expect(cls).toContain('tracking-wider-1');
  });
});
