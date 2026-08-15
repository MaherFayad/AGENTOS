import { describe, expect, it } from 'vitest';
import { buildGalaxy, GALAXY_PARTICLE_COUNT, particleBudget, particleBrightness } from './particles';

describe('galaxy particles', () => {
  it('renders no swirl at completeness 0 — a dark core, not a fake galaxy', () => {
    expect(particleBudget(0)).toBe(0);
    expect(buildGalaxy({ completeness: 0 })).toHaveLength(0);
  });

  it('reaches the 600-particle budget at completeness 1', () => {
    expect(particleBudget(1)).toBe(GALAXY_PARTICLE_COUNT);
    expect(buildGalaxy({ completeness: 1 })).toHaveLength(GALAXY_PARTICLE_COUNT);
  });

  it('is deterministic for a given seed', () => {
    const a = buildGalaxy({ completeness: 0.5, seed: 7 });
    const b = buildGalaxy({ completeness: 0.5, seed: 7 });
    expect(a).toEqual(b);
  });

  it('dims with completeness rather than faking a full swirl', () => {
    expect(particleBrightness(0)).toBeLessThan(particleBrightness(1));
  });
});
