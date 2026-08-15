'use client';

import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { highlightSegments, search as runSearch, type SearchItem, type SearchResult } from '../../lib/search';
import { emit } from '../../lib/shell-bus';
import { DURATION, GlassPanel, withReducedMotion } from './ui';
import { searchPlaceholder } from './route';
import { useShell } from './ShellContext';

/**
 * §2.0 top-left: the search pill — `--card` bg, 1px `--line`, view-aware placeholder,
 * fuzzy over agent names and descriptions, result click flies to the node.
 *
 * This control is also the **accessibility path into the map**. The galaxy is a canvas
 * and an SVG of ~150 circles; a keyboard user reaches a node by typing its name here and
 * pressing Enter. That is why this is a real combobox with `aria-activedescendant`
 * management and a live region, not an input with a dropdown glued under it.
 *
 * Shortcuts: `/` focuses · ↑ ↓ walk results · Enter opens · Esc closes, then blurs.
 */
export function SearchPill(): React.JSX.Element {
  const router = useRouter();
  const { route, search, reducedMotion } = useShell();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();

  const results = useMemo<SearchResult[]>(() => runSearch(search.items, query), [search.items, query]);
  const showPanel = open && query.trim().length > 0;

  useEffect(() => setActive(0), [query]);

  // `/` focuses search from anywhere — the single most useful key in a canvas app.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== '/' || event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || target?.isContentEditable) return;
      event.preventDefault();
      inputRef.current?.focus();
      inputRef.current?.select();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

  const select = useCallback(
    (item: SearchItem) => {
      // Fly first, navigate second: the canvas starts its 700ms camera move while the
      // route change opens the drawer over it (§1.6, contracts/graph-layout.md).
      if (item.kind === 'agent' || item.kind === 'department') {
        emit('shell:flyTo', {
          target:
            item.kind === 'agent'
              ? { kind: 'node', id: item.id, department: item.department }
              : { kind: 'department', id: item.id },
          source: 'search',
          durationMs: withReducedMotion(DURATION.zoom, reducedMotion),
        });
      }
      router.push(item.href);
      setOpen(false);
      setQuery('');
      inputRef.current?.blur();
    },
    [router, reducedMotion],
  );

  const onKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (event.key === 'Escape') {
        if (query.length > 0) setQuery('');
        else inputRef.current?.blur();
        setOpen(false);
        return;
      }
      if (!showPanel || results.length === 0) return;
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setActive((index) => (index + 1) % results.length);
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        setActive((index) => (index - 1 + results.length) % results.length);
      } else if (event.key === 'Enter') {
        event.preventDefault();
        const chosen = results[active];
        if (chosen) select(chosen.item);
      } else if (event.key === 'Home') {
        setActive(0);
      } else if (event.key === 'End') {
        setActive(results.length - 1);
      }
    },
    [showPanel, results, active, select, query.length],
  );

  const placeholder = searchPlaceholder(route.view);

  return (
    <div className="relative">
      <div className="flex h-8 w-[184px] items-center gap-2 rounded-full border border-line bg-card px-3 transition-colors focus-within:border-line-2 hover:border-line-2 sm:w-[220px]">
        <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.25" className="shrink-0 text-ink-2">
          <circle cx="7" cy="7" r="4.5" />
          <path d="M10.5 10.5 14 14" strokeLinecap="round" />
        </svg>
        <input
          ref={inputRef}
          type="text"
          role="combobox"
          aria-expanded={showPanel}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={showPanel && results[active] ? `${listId}-${active}` : undefined}
          aria-label={placeholder}
          placeholder={placeholder}
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => window.setTimeout(() => setOpen(false), 120)}
          onKeyDown={onKeyDown}
          className="w-full bg-transparent text-small text-ivory placeholder:text-ink-3 focus:outline-none"
        />
        <kbd className="hidden shrink-0 rounded-chip border border-line px-1 text-label-sm tracking-normal text-ink-3 sm:block" aria-hidden="true">
          /
        </kbd>
      </div>

      <p className="sr-only" role="status" aria-live="polite">
        {showPanel ? `${results.length} result${results.length === 1 ? '' : 's'} for ${query}` : ''}
      </p>

      {showPanel && (
        <div className="absolute left-0 top-[38px] z-drawer w-[320px]">
        <GlassPanel radius="md" shadow="drawer" className="block overflow-hidden p-1">
          <ul id={listId} role="listbox" aria-label={`${placeholder} results`} className="max-h-[320px] overflow-y-auto">
            {results.map((result, index) => (
              <li key={`${result.item.kind}:${result.item.id}`}>
                <button
                  type="button"
                  id={`${listId}-${index}`}
                  role="option"
                  aria-selected={index === active}
                  onMouseEnter={() => setActive(index)}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => select(result.item)}
                  className={`flex w-full items-baseline gap-2 rounded-[10px] px-3 py-2 text-left transition-colors ${
                    index === active ? 'bg-card-2' : 'bg-transparent'
                  }`}
                >
                  <span className="min-w-0 flex-1 truncate text-small text-ivory-2">
                    {highlightSegments(result.item.label, result.ranges).map((segment, segmentIndex) => (
                      <span key={segmentIndex} className={segment.matched ? 'text-ivory' : undefined}>
                        {segment.text}
                      </span>
                    ))}
                  </span>
                  <span className="shrink-0 text-label-sm uppercase tracking-wider-1 text-ink-3">
                    {result.item.kind === 'agent' ? (result.item.department ?? 'agent') : result.item.kind}
                  </span>
                </button>
              </li>
            ))}
            {results.length === 0 && (
              <li className="px-3 py-3 text-meta text-ink-2">
                {search.message ?? `Nothing matches “${query.trim()}”. Try part of a job name — the match doesn't have to be contiguous.`}
              </li>
            )}
          </ul>
        </GlassPanel>
        </div>
      )}
    </div>
  );
}
