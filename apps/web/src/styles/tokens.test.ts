import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * tokens.test.ts — the regression guard on Part I.
 *
 * These are their real values, read from the live site's stylesheet. A "small
 * improvement" to one of them is the failure mode this file exists to catch:
 * it would pass review, look fine in isolation, and quietly cost us the
 * side-by-side fidelity test at 1440px (Part VI acceptance).
 */

const CSS = readFileSync(fileURLToPath(new URL('./tokens.css', import.meta.url)), 'utf8');

/** Declarations grouped by selector. Good enough for a flat token file. */
function scope(selector: string): Record<string, string> {
  const out: Record<string, string> = {};
  const blocks = CSS.matchAll(/([^{}]+)\{([^}]*)\}/g);
  for (const [, sel, body] of blocks) {
    if (sel.trim() !== selector) continue;
    for (const [, name, value] of body.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
      out[name] = value.trim();
    }
  }
  return out;
}

const root = scope(':root');
const light = scope('body.light');

describe('§1.1 dark theme :root', () => {
  const expected: Record<string, string> = {
    '--bg': '#111114',
    '--bg-2': '#1B1B21',
    '--bg-3': '#060608',
    '--ivory': '#ECECEE',
    '--ivory-2': '#B2B2B9',
    '--ink-2': '#84848C',
    '--ink-3': '#6B6B73',
    '--copper': '#ECECEE',
    '--copper-ink': '#131315',
    '--line': 'rgba(255,255,255,.10)',
    '--line-2': 'rgba(255,255,255,.16)',
    '--card': 'rgba(255,255,255,.025)',
    '--card-2': 'rgba(255,255,255,.05)',
    '--glass': 'rgba(13,13,15,.72)',
    '--screen': '#101013',
    '--screen-2': '#16161A',
  };
  for (const [name, value] of Object.entries(expected)) {
    it(`${name} is ${value}`, () => expect(root[name]).toBe(value));
  }
});

describe('§1.2 light theme body.light', () => {
  const expected: Record<string, string> = {
    '--bg': '#F4F4F5',
    '--bg-2': '#ECECEE',
    '--bg-3': '#FFFFFF',
    '--ivory': '#161618',
    '--ivory-2': '#4C4C54',
    '--ink-2': '#6E6E76',
    '--ink-3': '#8D8D95',
    '--copper': '#18181B',
    '--copper-ink': '#FFFFFF',
    '--line': 'rgba(20,20,24,.10)',
    '--line-2': 'rgba(20,20,24,.17)',
    '--card': '#FFFFFF',
    '--card-2': '#EBEBED',
    '--glass': 'rgba(244,244,245,.80)',
    '--screen': '#FFFFFF',
    '--screen-2': '#F4F4F6',
  };
  for (const [name, value] of Object.entries(expected)) {
    it(`${name} is ${value}`, () => expect(light[name]).toBe(value));
  }

  it('overrides every chrome token — one missed override is an invisible-text bug', () => {
    const missing = Object.keys(expected).filter((n) => !(n in light));
    expect(missing).toEqual([]);
  });
});

describe('§1.3 data ink', () => {
  const expected: Record<string, string> = {
    '--ink-copper': '#C9784A',
    '--ink-copper-2': '#E08A50',
    '--ink-teal': '#4ECDB0',
    '--ink-coral': '#E5484D',
    '--ink-coral-2': '#F06A6D',
    '--ink-lavender': '#8B8DF0',
    '--ink-lavender-2': '#A5A7F5',
    '--ink-amber': '#E5A13C',
    '--ink-blue': '#6AA1F0',
  };
  for (const [name, value] of Object.entries(expected)) {
    it(`${name} is ${value}`, () => expect(root[name]).toBe(value));
  }

  it('does not swap with the theme — a status hue that changes is a lie', () => {
    for (const name of Object.keys(expected)) expect(light[name]).toBeUndefined();
  });
});

describe('§1.5 shape, depth, texture', () => {
  it('pills are 999px', () => expect(root['--r-pill']).toBe('999px'));
  it('cards sit in the 12–16px range', () => {
    expect(root['--r-card-sm']).toBe('12px');
    expect(root['--r-card']).toBe('14px');
    expect(root['--r-card-lg']).toBe('16px');
  });
  it('panels sit in the 16–20px range', () => {
    expect(root['--r-panel']).toBe('18px');
    expect(root['--r-panel-lg']).toBe('20px');
  });
  it('KPI tiles are 12px and chips are 6px', () => {
    expect(root['--r-kpi']).toBe('12px');
    expect(root['--r-chip']).toBe('6px');
  });
  it('hairlines are 1px', () => expect(root['--border-w']).toBe('1px'));
  it('dark mode has no shadow except the drawer', () => {
    expect(root['--shadow-soft']).toBe('none');
    expect(root['--shadow-drawer']).toBe('0 8px 40px rgba(0,0,0,.5)');
  });
  it('light mode gets the soft shadow', () => {
    expect(light['--shadow-soft']).toBe('0 1px 3px rgba(20,20,24,.06)');
  });
  it('glass blurs 14px', () => expect(root['--blur-glass']).toBe('14px'));
  it('dotted grid is rgba(255,255,255,.04) at 22px pitch', () => {
    expect(root['--dot-color']).toBe('rgba(255,255,255,.04)');
    expect(root['--dot-pitch']).toBe('22px');
  });
  it('starfield is ~200 points at opacity .05–.15', () => {
    expect(root['--star-count']).toBe('200');
    expect(root['--star-opacity-min']).toBe('.05');
    expect(root['--star-opacity-max']).toBe('.15');
  });
  it('galaxy glow blurs 60px', () => expect(root['--galaxy-glow-blur']).toBe('60px'));
  it('drawer scrim is rgba(0,0,0,.4)', () => expect(root['--scrim']).toBe('rgba(0,0,0,.4)'));
});

describe('§1.6 motion', () => {
  it('reveal is 500ms on cubic-bezier(.2,.7,.2,1) with 12px of travel', () => {
    expect(root['--dur-reveal']).toBe('500ms');
    expect(root['--ease-reveal']).toBe('cubic-bezier(.2,.7,.2,1)');
    expect(root['--reveal-y']).toBe('12px');
  });
  it('drawer is 320ms', () => expect(root['--dur-drawer']).toBe('320ms'));
  it('edges relax over 600ms', () => expect(root['--dur-relax']).toBe('600ms'));
  it('department transition is 700ms ease-in-out', () => {
    expect(root['--dur-zoom']).toBe('700ms');
    expect(root['--ease-zoom']).toBe('ease-in-out');
  });
  it('count-up is 300ms', () => expect(root['--dur-count']).toBe('300ms'));
  it('carousel is perspective 1400 / 35deg / rear .82 at brightness .5', () => {
    expect(root['--carousel-perspective']).toBe('1400px');
    expect(root['--carousel-rotate']).toBe('35deg');
    expect(root['--carousel-rear-scale']).toBe('.82');
    expect(root['--carousel-rear-brightness']).toBe('.5');
  });
  it('reduced motion collapses every duration at the token layer', () => {
    expect(CSS).toMatch(/@media\s*\(prefers-reduced-motion:\s*reduce\)/);
    const reduced = CSS.split('prefers-reduced-motion')[1] ?? '';
    for (const d of ['--dur-reveal', '--dur-drawer', '--dur-relax', '--dur-zoom', '--dur-count']) {
      expect(reduced).toContain(`${d}: 1ms`);
    }
  });
});

describe('§1.4 families', () => {
  it('wires all three self-hosted families', () => {
    expect(root['--font-sans']).toContain('Plus Jakarta Sans');
    expect(root['--font-serif']).toContain('Instrument Serif');
    expect(root['--font-arabic']).toContain('IBM Plex Sans Arabic');
  });
  it('never routes Arabic through the serif', () => {
    expect(root['--font-arabic']).not.toContain('Instrument Serif');
  });
  it('holds the four wide-tracking rungs across the +0.25em…+0.45em band', () => {
    expect(root['--track-1']).toBe('.25em');
    expect(root['--track-2']).toBe('.3em');
    expect(root['--track-3']).toBe('.35em');
    expect(root['--track-4']).toBe('.45em');
  });
});
