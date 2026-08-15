'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Panel } from '@agnetos/contracts';
import {
  CARD_WIDTH,
  cardTransform,
  dragToPosition,
  frontIndex,
  isAtRest,
  normalizePosition,
  settleTarget,
  springStep,
  step,
  velocityFrom,
  wrappedOffset,
  type DragSample,
  type SpringState,
} from '../lib/carousel';
import { ProviderGlyph } from '../lib/icons';
import { Eyebrow, Pill, carouselMotion, cx, useReducedMotion } from '../ui';
import s from '../dashboards.module.css';

export function Carousel({ panels }: { panels: readonly Panel[] }): React.JSX.Element {
  const router = useRouter();
  const reduced = useReducedMotion();
  const count = panels.length;
  const [position, setPosition] = useState(0);
  const [dragging, setDragging] = useState(false);
  const state = useRef<SpringState>({ position: 0, velocity: 0 });
  const target = useRef(0);
  const samples = useRef<DragSample[]>([]);
  const dragOrigin = useRef({ x: 0, pos: 0, moved: 0 });
  const raf = useRef(0);
  const lastFrame = useRef(0);

  const pin = useCallback(
    (next: number) => {
      const normalised = normalizePosition(next, count);
      state.current = { position: normalised, velocity: 0 };
      target.current = normalised;
      setPosition(normalised);
    },
    [count],
  );

  const go = useCallback(
    (next: number) => {
      if (reduced) {
        pin(Math.round(next));
        return;
      }
      target.current = next;
      lastFrame.current = 0;
      const tick = (now: number) => {
        const dt = lastFrame.current === 0 ? 16 : now - lastFrame.current;
        lastFrame.current = now;
        state.current = springStep(state.current, target.current, dt, carouselMotion.spring);
        if (isAtRest(state.current, target.current)) {
          pin(target.current);
          return;
        }
        setPosition(state.current.position);
        raf.current = requestAnimationFrame(tick);
      };
      cancelAnimationFrame(raf.current);
      raf.current = requestAnimationFrame(tick);
    },
    [pin, reduced],
  );

  useEffect(() => () => cancelAnimationFrame(raf.current), []);

  const front = frontIndex(position, count);
  const current = panels[front];

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    cancelAnimationFrame(raf.current);
    setDragging(true);
    dragOrigin.current = { x: event.clientX, pos: state.current.position, moved: 0 };
    samples.current = [{ x: event.clientX, t: event.timeStamp }];
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging) return;
    const next = dragToPosition(dragOrigin.current.pos, event.clientX - dragOrigin.current.x);
    dragOrigin.current.moved = Math.max(
      dragOrigin.current.moved,
      Math.abs(event.clientX - dragOrigin.current.x),
    );
    state.current = { position: next, velocity: 0 };
    setPosition(next);
    samples.current.push({ x: event.clientX, t: event.timeStamp });
    if (samples.current.length > 12) samples.current.shift();
  };

  const onPointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging) return;
    setDragging(false);
    const moved = dragOrigin.current.moved;
    samples.current.push({ x: event.clientX, t: event.timeStamp });
    if (moved < 8) {
      pin(Math.round(state.current.position));
      const onFront = (event.target as HTMLElement | null)?.closest?.('[role="option"][aria-selected="true"]');
      const card = panels[frontIndex(state.current.position, count)];
      if (onFront && card) router.push(`/dashboards/${card.id}`);
      return;
    }
    const velocity = reduced ? 0 : velocityFrom(samples.current);
    const rest = reduced
      ? Math.round(state.current.position)
      : settleTarget(state.current.position, velocity, carouselMotion.spring);
    state.current = { ...state.current, velocity };
    go(rest);
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      go(step(Math.round(position), -1));
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      go(step(Math.round(position), 1));
    } else if (event.key === 'Enter' && current) {
      router.push(`/dashboards/${current.id}`);
    }
  };

  return (
    <div className={s.carousel}>
      <div className={cx(s.floor, 'dot-grid')} aria-hidden="true" />
      <div className={s.ellipse} aria-hidden="true" />

      <header className={s.header}>
        <Eyebrow size="sm" as="p">
          THE OUTPUT LAYER
        </Eyebrow>
        <h1 className={s.carouselTitle}>Command Centers</h1>
        <p className={cx(s.subtitle, 'text-small')}>
          what each department looks like <em className="font-serif italic">when the work runs itself</em>
        </p>
      </header>

      <div
        className={s.stage}
        role="listbox"
        aria-label="Command Centers"
        aria-activedescendant={current ? `center-${current.id}` : undefined}
        tabIndex={0}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onKeyDown={onKeyDown}
      >
        <div className={s.ring} style={{ width: CARD_WIDTH }}>
          {panels.map((panel, index) => {
            const t = cardTransform(wrappedOffset(index, position, count));
            if (t.opacity <= 0) return null;
            return (
              <article
                key={panel.id}
                id={`center-${panel.id}`}
                role="option"
                aria-selected={t.isFront}
                className={cx(s.card, t.isFront && s.cardFront)}
                style={{
                  transform: `translateX(${t.translateX}px) translateZ(${t.translateZ}px) rotateY(${t.rotateY}deg) scale(${t.scale})`,
                  filter: `brightness(${t.brightness})`,
                  opacity: t.opacity,
                  zIndex: t.zIndex,
                }}
              >
                <div className={s.cardScreen}>
                  <p className="flex items-center gap-2 text-label uppercase tracking-wider-2 text-ink-2">
                    <ProviderGlyph provider={panel.provider} className="h-3.5 w-3.5" />
                    {panel.railTitle}
                  </p>
                  <h2 className="text-small font-semibold text-ivory">{panel.title}</h2>
                  <div className={s.previewKpis}>
                    {Array.from({ length: 5 }).map((_, i) => (
                      <div key={i} className={s.previewKpi} />
                    ))}
                  </div>
                  <div className={s.previewGrid}>
                    <div className={s.previewWidget} />
                    <div className={s.previewWidget} />
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </div>

      {current ? (
        <div className={s.caption}>
          <span className={cx(s.captionTitle, 'text-label-lg uppercase tracking-wider-2')}>
            {current.title}
          </span>
          <div className={s.captionRow}>
            <p className="text-meta text-ink-2">{current.caption}</p>
            <ProviderGlyph provider={current.provider} title={current.provider} />
          </div>
        </div>
      ) : null}

      <div className={s.controls}>
        <Pill
          variant="ghost"
          square
          aria-label="Previous Command Center"
          onClick={() => go(step(Math.round(position), -1))}
        >
          ‹
        </Pill>
        <div className={s.dots} role="tablist" aria-label="Command Center position">
          {panels.map((panel, i) => (
            <button
              key={panel.id}
              type="button"
              className={s.dot}
              aria-label={panel.title}
              aria-current={i === front ? 'true' : undefined}
              onClick={() => go(i)}
            />
          ))}
        </div>
        <Pill
          variant="ghost"
          square
          aria-label="Next Command Center"
          onClick={() => go(step(Math.round(position), 1))}
        >
          ›
        </Pill>
      </div>

      <p className={cx(s.hint, 'text-label uppercase tracking-wider-1')}>
        DRAG TO SPIN · CLICK THE FRONT CARD TO ENTER
      </p>
    </div>
  );
}
