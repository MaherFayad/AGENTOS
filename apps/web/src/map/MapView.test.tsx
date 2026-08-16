import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { I18nProvider } from '@/i18n';
import { GRAPH_FIXTURE } from './__fixtures__/graph';
import { MapEmptyState } from './chrome/EmptyState';
import { MapView } from './MapView';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
  // M15: `MapView` builds drill-in URLs through `useProjectHref`, which reads the project
  // segment off the pathname. Project-scoped here so the mock reflects a real address
  // rather than the pre-project shape the app no longer emits.
  usePathname: () => '/p/agentos/map',
}));

describe('<MapEmptyState>', () => {
  it('says the payload is missing and does not invent a node count', () => {
    const markup = renderToStaticMarkup(
      <I18nProvider>
        <MapEmptyState reason="map.empty.notBuilt" serverMessage={null} />
      </I18nProvider>,
    );
    expect(markup).toContain('data-testid="map-empty-state"');
    expect(markup).toContain('not been built yet');
    expect(markup).not.toContain('150');
    expect(markup).not.toContain('22 LIVE');
  });
});

describe('<MapView>', () => {
  it('mounts the canvas underlay and the SVG graph from a stored payload', () => {
    const markup = renderToStaticMarkup(
      <I18nProvider>
        <MapView payload={GRAPH_FIXTURE} />
      </I18nProvider>,
    );
    expect(markup).toContain('data-testid="map-galaxy"');
    expect(markup).toContain('aria-hidden="true"');
    expect(markup).toContain('<canvas');
    expect(markup).toContain('aria-label="Agent galaxy"');
    expect(markup).toContain('Account Enrichment');
    expect(markup).toContain('SALES');
  });

  it('does not print a fabricated live count', () => {
    const markup = renderToStaticMarkup(
      <I18nProvider>
        <MapView payload={GRAPH_FIXTURE} />
      </I18nProvider>,
    );
    expect(markup).not.toContain('0 OF 22');
    expect(markup).not.toContain('150 nodes');
  });

  it('shows the honest empty sky while the payload is missing — no placeholder nodes', () => {
    const markup = renderToStaticMarkup(
      <I18nProvider>
        <MapView />
      </I18nProvider>,
    );
    expect(markup).toContain('<canvas');
    expect(markup).not.toContain('Account Enrichment');
    expect(markup).not.toContain('data-testid="map-empty-state"');
  });
});
