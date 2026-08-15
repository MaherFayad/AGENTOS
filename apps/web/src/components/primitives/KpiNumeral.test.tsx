/** @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { KpiNumeral } from './KpiNumeral';

/** jsdom has no matchMedia; the helper treats "absent" as "motion allowed". */
function mockReducedMotion(matches: boolean) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: (query: string) => ({
      matches: query.includes('prefers-reduced-motion') ? matches : false,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }),
  });
}

afterEach(() => {
  vi.restoreAllMocks();
  // @ts-expect-error — put jsdom back the way we found it.
  delete window.matchMedia;
});

describe('KpiNumeral (§1.4, §1.6)', () => {
  it('is tabular so the tile does not jitter while counting', () => {
    render(<KpiNumeral value={22} />);
    expect(screen.getByLabelText('22').className).toContain('tabular-nums');
  });

  it('is 28–32px at weight 600', () => {
    const { container } = render(<KpiNumeral value={1} size="lg" />);
    expect(container.firstElementChild!.className).toContain('text-kpi-lg');
  });

  it('starts at zero and lands on the value', async () => {
    render(<KpiNumeral value={22} />);
    const el = screen.getByLabelText('22');
    expect(el.textContent).toBe('0');
    await waitFor(() => expect(el.textContent).toBe('22'));
  });

  it('renders the end state immediately under prefers-reduced-motion', () => {
    mockReducedMotion(true);
    render(<KpiNumeral value={22} />);
    expect(screen.getByLabelText('22').textContent).toBe('22');
  });

  it('announces the final value once, not every intermediate frame', () => {
    render(
      <KpiNumeral value={12.4} decimals={2} prefix="$" suffix=" today" />,
    );
    const el = screen.getByLabelText('$12.40 today');
    expect(el.querySelector('[aria-hidden="true"]')).toBeTruthy();
  });

  it('takes its tone from the number, not from taste', () => {
    const { container: alive } = render(<KpiNumeral value={3} tone="alive" />);
    expect(alive.firstElementChild!.className).toContain('text-ink-copper-2');

    const { container: up } = render(<KpiNumeral value={3} tone="up" />);
    expect(up.firstElementChild!.className).toContain('text-ink-teal');

    const { container: plain } = render(<KpiNumeral value={3} />);
    expect(plain.firstElementChild!.className).toContain('text-ivory');
  });
});
