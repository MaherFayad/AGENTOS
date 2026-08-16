import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { buildGalaxy, particleBrightness } from '../lib/particles';
import { BrainEmptyState, brainCountSentence } from './BrainEmptyState';

const core = (over: Partial<{ brainCompleteness: number; brainAnswered: number | null; brainTotal: number | null }> = {}) => ({
  x: 0,
  y: 0,
  brainCompleteness: 0,
  brainAnswered: 0,
  brainTotal: 20,
  ...over,
});

describe('the Second Brain at 0 of 20 (§3.3)', () => {
  it('says how empty it is, in words, from the payload count', () => {
    const markup = renderToStaticMarkup(<BrainEmptyState core={core()} scale={1} />);
    expect(markup).toContain('data-testid="brain-empty-state"');
    expect(markup).toContain('0 of 20 questions answered');
    expect(markup).toContain('Run the company interview');
  });

  it('draws no swirl at all — an empty brain is empty, not 45% bright', () => {
    expect(buildGalaxy({ completeness: 0 })).toHaveLength(0);
    // The old heading-count bug reported a 0/20 brain as 0.45. Pin what that would have
    // painted so the difference is visible in a test, not only on screen.
    expect(buildGalaxy({ completeness: 0.45 }).length).toBeGreaterThan(250);
    expect(particleBrightness(0)).toBeLessThan(particleBrightness(0.45));
  });

  it('disappears the moment a single question is answered', () => {
    const markup = renderToStaticMarkup(
      <BrainEmptyState core={core({ brainCompleteness: 0.05, brainAnswered: 1 })} scale={1} />,
    );
    expect(markup).toBe('');
    expect(buildGalaxy({ completeness: 0.05 }).length).toBeGreaterThan(0);
  });

  it('refuses to invent a denominator it was not given', () => {
    expect(brainCountSentence(core({ brainTotal: null, brainAnswered: null }))).toBe(
      'No interview answers yet',
    );
    const markup = renderToStaticMarkup(
      <BrainEmptyState core={core({ brainTotal: null, brainAnswered: null })} scale={1} />,
    );
    expect(markup).not.toContain(' of 20');
  });

  it('counter-scales with the camera so the sentence stays readable when zoomed out', () => {
    const markup = renderToStaticMarkup(<BrainEmptyState core={core()} scale={0.5} />);
    expect(markup).toContain('scale(2)');
  });
});
