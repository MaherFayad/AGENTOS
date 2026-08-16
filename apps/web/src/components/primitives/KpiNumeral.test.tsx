/** @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import { KpiNumeral } from './KpiNumeral';
import { DURATION } from './motion';

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

/**
 * Take the animation off the wall clock. Returns a `step(ms)` that drives the
 * component one rAF frame at a time with a timestamp WE choose, so a test can
 * ask what happens at t = -845ms instead of hoping the machine reproduces it.
 */
function driveFrames() {
  const queue: FrameRequestCallback[] = [];
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    queue.push(cb);
    return queue.length;
  });
  vi.stubGlobal('cancelAnimationFrame', () => {});
  return {
    get pending() {
      return queue.length;
    },
    /** Fire every frame currently queued, at `stamp` on the rAF clock. */
    step(stamp: number) {
      const due = queue.splice(0, queue.length);
      act(() => {
        for (const cb of due) cb(stamp);
      });
    },
  };
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
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

  /**
   * REGRESSION — 2026-08-16, fidelity-qa-reviewer.
   *
   * `t` was clamped at the top only: `Math.min(1, (now - start) / countUp)`.
   * `start` came from `performance.now()`, `now` from the rAF callback — two
   * clocks with different time origins. jsdom skews them by ~845ms, so t went
   * to about -40, `easeOut` cubed it to about -73500, and the tile painted
   * 22 x -73513 = -1617290. That is a fabricated number on the most credible
   * surface in the product (BOARD rule 9 / Part VII.3), not a cosmetic glitch.
   *
   * The assertion is the INVARIANT, not the endpoint: nothing outside
   * [from, to] is ever handed to `format`. A test that only checks it reaches
   * 22 passes against a component that visits -1617290 on the way there.
   */
  it('never paints outside [from, to], even when the rAF clock trails performance.now', () => {
    const frames = driveFrames();
    // The exact skew the reviewer measured in this repo's jsdom.
    vi.spyOn(performance, 'now').mockReturnValue(1061.6);
    const rafOrigin = 216.84; // ~845ms behind performance.now()

    const painted: number[] = [];
    render(
      <KpiNumeral
        value={22}
        format={(n) => {
          painted.push(n);
          return n.toFixed(0);
        }}
      />,
    );

    // Walk the full count-up and a few frames past its end, ~60fps.
    for (let i = 0; i <= 24 && frames.pending; i++) {
      frames.step(rafOrigin + i * 16.7);
    }

    expect(painted.length).toBeGreaterThan(1); // it really did animate
    const stray = painted.filter((n) => n < 0 || n > 22);
    expect(stray).toEqual([]);
    expect(Math.min(...painted)).toBeGreaterThanOrEqual(0);
    expect(screen.getByLabelText('22').textContent).toBe('22');
  });

  it('lands exactly on the target rather than one short of it', () => {
    const frames = driveFrames();
    const el0 = 1000;
    render(<KpiNumeral value={22} />);
    // One frame at the start, one frame past the end of the count-up.
    frames.step(el0);
    frames.step(el0 + DURATION.countUp + 1);
    expect(screen.getByLabelText('22').textContent).toBe('22');
  });

  it('counts down without dipping below the target', () => {
    const frames = driveFrames();
    const painted: number[] = [];
    const fmt = (n: number) => {
      painted.push(n);
      return n.toFixed(0);
    };
    const { rerender } = render(<KpiNumeral value={10} format={fmt} />);
    frames.step(500);
    frames.step(500 + DURATION.countUp + 1); // settle at 10
    painted.length = 0;

    rerender(<KpiNumeral value={4} format={fmt} />);
    for (let i = 0; i <= 24 && frames.pending; i++) frames.step(900 + i * 16.7);

    // Travelling 10 -> 4 must never overshoot past 4 or above 10.
    expect(painted.filter((n) => n < 4 || n > 10)).toEqual([]);
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
