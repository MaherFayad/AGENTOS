import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { GRAPH_FIXTURE } from './__fixtures__/graph';
import { MapEmptyState } from './chrome/EmptyState';
import { MapView } from './MapView';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
}));

describe('<MapEmptyState>', () => {
  it('says the payload is missing and does not invent a node count', () => {
    const markup = renderToStaticMarkup(
      <MapEmptyState message="The map layout has not been built yet. Run npm run graph:build." />,
    );
    expect(markup).toContain('data-testid="map-empty-state"');
    expect(markup).toContain('not been built yet');
    expect(markup).not.toContain('150');
    expect(markup).not.toContain('22 LIVE');
  });
});

describe('<MapView>', () => {
  it('mounts the canvas underlay and the SVG graph from a stored payload', () => {
    const markup = renderToStaticMarkup(<MapView payload={GRAPH_FIXTURE} />);
    expect(markup).toContain('data-testid="map-galaxy"');
    expect(markup).toContain('aria-hidden="true"');
    expect(markup).toContain('<canvas');
    expect(markup).toContain('aria-label="Agent galaxy"');
    expect(markup).toContain('Account Enrichment');
    expect(markup).toContain('SALES');
  });

  it('does not print a fabricated live count', () => {
    const markup = renderToStaticMarkup(<MapView payload={GRAPH_FIXTURE} />);
    expect(markup).not.toContain('0 OF 22');
    expect(markup).not.toContain('150 nodes');
  });

  it('shows the honest empty sky while the payload is missing — no placeholder nodes', () => {
    const markup = renderToStaticMarkup(<MapView />);
    expect(markup).toContain('<canvas');
    expect(markup).not.toContain('Account Enrichment');
    expect(markup).not.toContain('data-testid="map-empty-state"');
  });
});
