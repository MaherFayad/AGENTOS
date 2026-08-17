/** @vitest-environment jsdom */

/**
 * The direction half of the tab bar's keyboard, proved without a component around it.
 *
 * The component test (`components/DepartmentTabs.test.tsx`) is the one that would have
 * caught the bug; this one pins the *rule*, including the rule about where it must not be
 * applied — the matrix grid's phase columns are time, and time does not reverse because
 * the page does (`DOES_NOT_MIRROR['chart.phaseColumns']`).
 */

import { describe, expect, it } from 'vitest';
import { moveGridFocus } from './keyboard';
import { elementDirection, inlineStep } from './direction';

describe('inlineStep', () => {
  it('LTR: ArrowRight is forward, ArrowLeft is back', () => {
    expect(inlineStep('ArrowRight', 'ltr')).toBe(1);
    expect(inlineStep('ArrowLeft', 'ltr')).toBe(-1);
  });

  it('RTL: the two swap, because the row is reversed', () => {
    expect(inlineStep('ArrowRight', 'rtl')).toBe(-1);
    expect(inlineStep('ArrowLeft', 'rtl')).toBe(1);
  });

  it('is 0 for anything else, so the key bubbles', () => {
    for (const key of ['ArrowUp', 'ArrowDown', 'Tab', 'Enter', ' ', 'Home', 'a']) {
      expect(inlineStep(key, 'rtl')).toBe(0);
    }
  });
});

describe('elementDirection', () => {
  const inside = (html: string) => {
    const host = document.createElement('div');
    host.innerHTML = html;
    document.body.append(host);
    return host.querySelector('[data-probe]')!;
  };

  it('inherits from the nearest ancestor carrying dir, as HTML does', () => {
    expect(elementDirection(inside('<div dir="rtl"><span data-probe></span></div>'))).toBe('rtl');
    expect(elementDirection(inside('<div dir="ltr"><span data-probe></span></div>'))).toBe('ltr');
  });

  it('lets a nested LTR island win over an RTL page', () => {
    expect(
      elementDirection(inside('<div dir="rtl"><div dir="ltr"><span data-probe></span></div></div>')),
    ).toBe('ltr');
  });

  it('reads dir off the element itself', () => {
    expect(elementDirection(inside('<span data-probe dir="RTL"></span>'))).toBe('rtl');
  });

  it('is ltr with no dir anywhere, and for dir="auto", which cannot be computed here', () => {
    expect(elementDirection(inside('<span data-probe></span>'))).toBe('ltr');
    expect(elementDirection(inside('<div dir="auto"><span data-probe></span></div>'))).toBe('ltr');
    expect(elementDirection(null)).toBe('ltr');
  });

  it('follows document.documentElement, which is where the app sets it', () => {
    document.documentElement.setAttribute('dir', 'rtl');
    try {
      expect(elementDirection(inside('<span data-probe></span>'))).toBe('rtl');
    } finally {
      document.documentElement.removeAttribute('dir');
    }
  });
});

describe('the matrix grid deliberately does not use any of this', () => {
  it('ArrowRight still advances the phase column, because phases 1→4 are a timeline', () => {
    // DOES_NOT_MIRROR['chart.phaseColumns']. If this ever flips under RTL it is a second
    // bug, not a completion of the tab-bar fix.
    const counts = [
      [1, 1, 1, 1],
      [1, 1, 1, 1],
      [1, 1, 1, 1],
    ];
    expect(moveGridFocus({ row: 0, col: 1, item: 0 }, 'ArrowRight', counts)).toEqual({
      row: 0,
      col: 2,
      item: 0,
    });
  });
});
