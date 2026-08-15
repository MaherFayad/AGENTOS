'use client';

import { useRef } from 'react';
import { cx } from './cx';

/**
 * SegmentedControl — §2.0, the MAP | DASHBOARDS | CHART | SESSIONS tabs.
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
 */

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
  /** Optional badge, e.g. a live count next to SESSIONS. */
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
    let next = index;
    if (e.key === 'ArrowRight') next = index === last ? 0 : index + 1;
    else if (e.key === 'ArrowLeft') next = index === 0 ? last : index - 1;
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
