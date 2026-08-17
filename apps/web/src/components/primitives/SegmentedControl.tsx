'use client';

import { useRef } from 'react';
import { elementDirection, inlineStep } from '@/chart/model/direction';
import { cx } from './cx';

/**
 * SegmentedControl — §2.0, the MAP | DASHBOARDS | CHART | THREADS tabs.
 *
 * Active tab is an ivory pill with dark text; inactive is `--ink-2`; 11px,
 * uppercase, +0.25em. The ivory pill with inverted text is expressed as
 * `bg-copper text-copper-ink`, which resolves to exactly that pair in dark and
 * inverts correctly in light — the same reason Pill's primary variant works
 * without a theme branch (§1.2).
 *
 * The trailing padding is 0.25em narrower than the leading padding because
 * letter-spacing adds a phantom space after the last glyph. Without the
 * compensation every tracked label in the shell sits a hair left of centre;
 * with it, they look drawn rather than typed.
 *
 * ---
 *
 * **Arrow keys follow reading order.** `MIRRORS['shell.segmentedControl']` names this
 * control: *"§2.0 — tab order is reading order."* The tablist is an `inline-flex` row, so
 * `dir="rtl"` reverses it on its own and MAP sits at the far *right*; before 2026-08-17 the
 * handler mapped `ArrowRight` to `+1` regardless, so the arrows ran backwards for every
 * Arabic reader of the shell's primary navigation. `inlineStep` reverses with the row;
 * `elementDirection` reads the direction off the rendered tree, so a control inside one of
 * §2.5's or §3.1's LTR islands keys LTR even on an RTL page.
 *
 * **`Home` and `End` deliberately do not mirror.** They are ordinal — "the first tab", not
 * "the tab at the leading edge" — and flipping them would be a second bug rather than a
 * completion of the fix. Same test as everywhere else: reading order mirrors, ordinals,
 * space and time do not.
 *
 * **On the import above, which points the wrong way.** A primitive should not depend on a
 * view, and `@/chart/model/direction` is `chart-matrix-engineer`'s. It is deliberate and
 * interim: the alternative is a second copy of the same six lines, and two copies of one
 * rule is exactly what let this bug exist in two components at once. The promotion target
 * is `i18n/direction.ts`, next to `inlineSign` and the `MIRRORS` table that governs both
 * call sites — `rtl-arabic-pdpl-specialist`'s file, so it is proposed rather than performed
 * (`decision-request` of 2026-08-17). Until then the odd import is the visible debt, which
 * is the point of leaving it visible.
 */

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
  /** Optional badge, e.g. a live count next to a tab. Chrome, so monochrome (§1.3). */
  badge?: string | number;
}

export interface SegmentedControlProps<T extends string> {
  options: readonly SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /** Required — a tablist with no name is a screen-reader dead end. */
  label: string;
  className?: string;
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  label,
  className,
}: SegmentedControlProps<T>) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  const onKeyDown = (e: React.KeyboardEvent, index: number) => {
    const last = options.length - 1;
    // The step is along the LIST, and the wrap with it — never along the screen.
    const delta = inlineStep(e.key, elementDirection(e.currentTarget));
    let next: number;
    if (delta !== 0) next = (index + delta + options.length) % options.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = last;
    else return;
    e.preventDefault();
    onChange(options[next].value);
    refs.current[next]?.focus();
  };

  return (
    <div
      role="tablist"
      aria-label={label}
      className={cx(
        'inline-flex items-center gap-1 rounded-pill border border-line bg-card p-1',
        className,
      )}
    >
      {options.map((option, i) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="tab"
            aria-selected={active}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(option.value)}
            onKeyDown={(e) => onKeyDown(e, i)}
            className={cx(
              'inline-flex h-7 items-center gap-2 rounded-pill font-sans text-label uppercase',
              'tracking-wider-1 ps-4 pe-[calc(1rem-0.25em)]',
              'transition-colors duration-hover ease-reveal',
              'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-line-2',
              active ? 'bg-copper text-copper-ink' : 'text-ink-2 hover:text-ivory-2',
            )}
          >
            {option.label}
            {option.badge !== undefined && (
              <span className="tabular-nums opacity-70">{option.badge}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
