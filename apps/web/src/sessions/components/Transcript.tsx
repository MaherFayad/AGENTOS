'use client';

/* =============================================================================
 * components/Transcript.tsx — the streaming log, virtualized (§3.1)
 *
 * A long Claude Code session is tens of thousands of lines. Mounting them all
 * turns a phone into a slideshow, so only the rows near the viewport exist in
 * the DOM; the rest are two spacer divs (`lib/virtual.ts`).
 *
 * Heights are measured, not assumed: a tool call is one line and a diff is
 * forty. Each rendered row reports its height back into a cache and the offsets
 * are recomputed — which is why scrolling through a mixed transcript does not
 * drift.
 *
 * Monospace on `--screen`, and grey levels rather than hue for speakers. A
 * terminal-theme rainbow here would be exactly the "extra colour" §1.3 warns
 * about — chrome is monochrome, and a transcript is chrome.
 * ========================================================================== */

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { buildOffsets, isPinnedToBottom, windowFor } from '../lib/virtual';
import s from '../sessions.module.css';
import type { TranscriptEntry } from '../types';

/** One line of 12px monospace with padding. Only used until a row is measured. */
const ESTIMATED_ROW = 22;

export function Transcript({
  entries,
  gap,
}: {
  entries: readonly TranscriptEntry[];
  gap: boolean;
}): React.JSX.Element {
  const scroller = useRef<HTMLDivElement | null>(null);
  const heights = useRef(new Map<number, number>());
  const [, forceRender] = useState(0);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewport, setViewport] = useState(600);
  const pinned = useRef(true);

  const offsets = buildOffsets(entries.length, heights.current, ESTIMATED_ROW);
  const win = windowFor(offsets, scrollTop, viewport);

  const onScroll = useCallback(() => {
    const el = scroller.current;
    if (!el) return;
    setScrollTop(el.scrollTop);
    pinned.current = isPinnedToBottom(el.scrollTop, el.clientHeight, el.scrollHeight);
  }, []);

  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const observer = new ResizeObserver(() => setViewport(el.clientHeight));
    observer.observe(el);
    setViewport(el.clientHeight);
    return () => observer.disconnect();
  }, []);

  // Follow the stream only if the reader is already at the bottom. Yanking
  // someone back down while they read history is how a live log becomes
  // unusable — and on a phone they cannot easily get back.
  useLayoutEffect(() => {
    const el = scroller.current;
    if (el && pinned.current) el.scrollTop = el.scrollHeight;
  }, [entries.length]);

  const measure = useCallback((index: number, height: number) => {
    if (heights.current.get(index) === height) return;
    heights.current.set(index, height);
    forceRender((n) => n + 1);
  }, []);

  const visible = entries.slice(win.start, win.end);

  return (
    <div className={s.transcript} ref={scroller} onScroll={onScroll} role="log" aria-live="polite">
      {gap ? (
        <p className={s.gap}>
          Some lines were missed while this device was offline — the relay’s replay buffer
          had already rolled past them.
        </p>
      ) : null}

      <div style={{ height: win.padTop }} aria-hidden="true" />
      {visible.map((entry, i) => (
        <Row key={entry.seq} entry={entry} index={win.start + i} onMeasure={measure} />
      ))}
      <div style={{ height: win.padBottom }} aria-hidden="true" />

      {entries.length === 0 ? (
        <p className={s.empty}>
          <span className={s.emptyTitle}>Nothing yet</span>
          This session hasn’t said anything since it started. Type below to steer it.
        </p>
      ) : null}
    </div>
  );
}

function Row({
  entry,
  index,
  onMeasure,
}: {
  entry: TranscriptEntry;
  index: number;
  onMeasure: (index: number, height: number) => void;
}): React.JSX.Element {
  const ref = useRef<HTMLDivElement | null>(null);

  useLayoutEffect(() => {
    if (ref.current) onMeasure(index, ref.current.offsetHeight);
  });

  return (
    <div className={s.entry} data-kind={entry.kind} ref={ref}>
      {entry.kind === 'permission' ? (
        // The live card is docked above the composer, always reachable without
        // scrolling. This line is the history of it.
        <span>
          [permission] {entry.permission?.tool ?? 'tool'} — {entry.permission?.summary ?? ''}
        </span>
      ) : (
        entry.text
      )}
    </div>
  );
}
