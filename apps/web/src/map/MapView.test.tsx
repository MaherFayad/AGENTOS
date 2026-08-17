import { renderToStaticMarkup } from 'react-dom/server';
import { fireEvent, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { I18nProvider } from '@/i18n';
import { GRAPH_FIXTURE } from './__fixtures__/graph';
import { MapEmptyState } from './chrome/EmptyState';
import { MapView } from './MapView';

// M15: `MapView` builds drill-in URLs through `useProjectHref`, which reads the project
// segment off the pathname. Project-scoped here so the mock reflects a real address rather
// than the pre-project shape the app no longer emits.
//
// `push` is hoisted and shared rather than a fresh `vi.fn()` per call, because a spy the
// test cannot reach is a spy that asserts nothing — which is how the pushed URL went
// unchecked through the milestone that changed it.
const nav = vi.hoisted(() => ({ push: vi.fn() }));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: nav.push, replace: vi.fn(), prefetch: vi.fn() }),
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

/**
 * REQ-MAP-38. The requirement is about the URL that leaves the component, so the test
 * asserts that string and nothing softer — mounting under a project path and checking the
 * markup would pass just as well against a component that pushes the pre-M15 shape.
 */
describe('<MapView> drill-in', () => {
  beforeEach(() => {
    nav.push.mockClear();
    // jsdom implements neither. `getContext` returning null is what jsdom already does —
    // stubbing it only stops the "not implemented" stack from filling the CI log, and the
    // canvas is `aria-hidden` decoration this test does not look at.
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe(): void {}
        unobserve(): void {}
        disconnect(): void {}
      },
    );
  });
  afterEach(() => vi.unstubAllGlobals());

  const mount = (): HTMLElement =>
    render(
      <I18nProvider>
        <MapView payload={GRAPH_FIXTURE} />
      </I18nProvider>,
    ).container;

  it('activating an anchor pushes the department URL inside the current project', () => {
    const container = mount();
    const anchor = container.querySelector('[data-node-id="sales/_anchor"]');
    expect(anchor).not.toBeNull();
    fireEvent.click(anchor!);
    expect(nav.push).toHaveBeenCalledWith('/p/agentos/map/sales');
  });

  it('activating a job pushes the agent URL inside the current project', () => {
    const container = mount();
    const job = container.querySelector('[data-node-id="sales/account-enrichment"]');
    expect(job).not.toBeNull();
    fireEvent.click(job!);
    expect(nav.push).toHaveBeenCalledWith('/p/agentos/map/sales/account-enrichment');
  });

  it('never pushes the pre-project shape', () => {
    const container = mount();
    fireEvent.click(container.querySelector('[data-node-id="sales/_anchor"]')!);
    for (const [url] of nav.push.mock.calls) expect(String(url).startsWith('/p/')).toBe(true);
  });
});
