/** @vitest-environment jsdom */
import { describe, expect, it } from 'vitest';
import {
  DURATION,
  EASE,
  EASE_ARRAY,
  REVEAL_Y,
  SCRIM,
  SECONDS,
  carousel,
  drawer,
  relax,
  reveal,
  withReducedMotion,
  zoom,
} from './motion';

describe('motion (§1.6)', () => {
  it('holds the verified durations', () => {
    expect(DURATION.reveal).toBe(500);
    expect(DURATION.drawer).toBe(320);
    expect(DURATION.relax).toBe(600);
    expect(DURATION.zoom).toBe(700);
    expect(DURATION.countUp).toBe(300);
  });

  it('exposes the same values in seconds for Framer Motion', () => {
    expect(SECONDS.drawer).toBeCloseTo(0.32);
    expect(SECONDS.reveal).toBeCloseTo(0.5);
  });

  it('reveal is opacity 0→1 plus translateY 12px→0 on the §1.6 curve', () => {
    expect(EASE.reveal).toBe('cubic-bezier(.2,.7,.2,1)');
    expect(EASE_ARRAY.reveal).toEqual([0.2, 0.7, 0.2, 1]);
    expect(REVEAL_Y).toBe(12);
    expect(reveal.initial).toEqual({ opacity: 0, y: 12 });
    expect(reveal.animate).toEqual({ opacity: 1, y: 0 });
    expect(reveal.transition.duration).toBeCloseTo(0.5);
  });

  it('drawer slides from the left for MAP and the right for CHART', () => {
    expect(drawer('left').initial).toEqual({ x: '-100%' });
    expect(drawer('right').initial).toEqual({ x: '100%' });
    expect(drawer().transition.duration).toBeCloseTo(0.32);
  });

  it('department transition is 700ms ease-in-out', () => {
    expect(zoom.duration).toBe(700);
    expect(zoom.ease).toBe('ease-in-out');
  });

  it('force restart uses alphaTarget 0.3 and edges relax over 600ms', () => {
    expect(relax.alphaTarget).toBe(0.3);
    expect(relax.duration).toBe(600);
  });

  it('carousel is perspective 1400 / rotateY 35 / rear 0.82 at brightness .5', () => {
    expect(carousel.perspective).toBe(1400);
    expect(carousel.rotate).toBe(35);
    expect(carousel.frontScale).toBe(1);
    expect(carousel.rearScale).toBeCloseTo(0.82);
    expect(carousel.rearBrightness).toBeCloseTo(0.5);
  });

  it('names the scrim as a token, never as an rgba literal', () => {
    expect(SCRIM).toBe('var(--scrim)');
  });

  it('collapses any duration when motion is reduced', () => {
    expect(withReducedMotion(DURATION.zoom, true)).toBe(0);
    expect(withReducedMotion(DURATION.zoom, false)).toBe(700);
  });
});
