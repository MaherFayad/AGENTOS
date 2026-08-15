import { describe, expect, it } from 'vitest';
import { ZOOM_MAX, ZOOM_MIN } from '@agnetos/contracts';
import {
  clampScale,
  fitBounds,
  nearestDepartment,
  stepScale,
  toPercent,
} from './camera';
import { GRAPH_FIXTURE } from '../__fixtures__/graph';

describe('camera', () => {
  it('clamps zoom to the 30–300% budget', () => {
    expect(clampScale(0)).toBe(ZOOM_MIN);
    expect(clampScale(10)).toBe(ZOOM_MAX);
    expect(clampScale(1)).toBe(1);
  });

  it('reports zoom as a percentage', () => {
    expect(toPercent(1)).toBe(100);
    expect(toPercent(0.3)).toBe(30);
  });

  it('fits the stored bounds inside the viewport', () => {
    const t = fitBounds(GRAPH_FIXTURE.bounds, { width: 1440, height: 900 });
    expect(t.k).toBeGreaterThan(ZOOM_MIN);
    expect(t.k).toBeLessThanOrEqual(ZOOM_MAX);
  });

  it('names the department whose anchor is nearest the viewport centre', () => {
    const t = { x: 720, y: 670, k: 1 };
    expect(nearestDepartment(GRAPH_FIXTURE.nodes, t, { width: 1440, height: 900 })).toBe('sales');
  });

  it('steps zoom geometrically and stays inside the budget', () => {
    expect(stepScale(1, 'in')).toBeGreaterThan(1);
    expect(stepScale(ZOOM_MAX, 'in')).toBe(ZOOM_MAX);
  });
});
