import { fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SearchPill } from './SearchPill';
import { on, resetBusForTests } from '../../lib/shell-bus';
import { GRAPH_FIXTURE, renderShell, routerMock, stubFetch } from './test-harness';

vi.mock('next/navigation', async () => (await import('./test-mocks')).navigationMock());
vi.mock('./ui', async () => (await import('./test-mocks')).uiMock());

beforeEach(() => stubFetch({ '/api/p/agentos/graph': { json: GRAPH_FIXTURE } }));
afterEach(() => {
  vi.unstubAllGlobals();
  routerMock.push.mockClear();
  resetBusForTests();
});

const type = (value: string): HTMLInputElement => {
  const input = screen.getByRole('combobox') as HTMLInputElement;
  fireEvent.focus(input);
  fireEvent.change(input, { target: { value } });
  return input;
};

describe('SearchPill (§2.0)', () => {
  it('uses the view-aware placeholder', async () => {
    const { unmount } = renderShell(<SearchPill />, { pathname: '/map' });
    expect(screen.getByRole('combobox').getAttribute('placeholder')).toBe('Search jobs');
    unmount();

    renderShell(<SearchPill />, { pathname: '/dashboards' });
    expect(screen.getByRole('combobox').getAttribute('placeholder')).toBe('Search panels');
  });

  it('fuzzy-matches an agent from the graph payload', async () => {
    renderShell(<SearchPill />);
    await waitFor(() => expect(fetch).toHaveBeenCalled());
    type('acen');
    await waitFor(() => expect(screen.getByRole('option', { name: /account enrichment/i })).toBeTruthy());
  });

  it('flies the map to the node and opens its route on Enter', async () => {
    const flyTo = vi.fn();
    on('shell:flyTo', flyTo);
    renderShell(<SearchPill />);
    await waitFor(() => expect(fetch).toHaveBeenCalled());

    const input = type('account');
    await waitFor(() => expect(screen.getAllByRole('option').length).toBeGreaterThan(0));
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(flyTo).toHaveBeenCalledWith(
      expect.objectContaining({
        target: { kind: 'node', id: 'sales/account-enrichment', department: 'sales' },
        source: 'search',
      }),
    );
    // M15: a search result is a link into *this project's* map (ADR-014 §2 — the same
    // slug in two projects is two different agents).
    expect(routerMock.push).toHaveBeenCalledWith('/p/agentos/map/sales/account-enrichment');
  });

  it('walks results with the arrow keys', async () => {
    renderShell(<SearchPill />);
    await waitFor(() => expect(fetch).toHaveBeenCalled());
    const input = type('a');
    await waitFor(() => expect(screen.getAllByRole('option').length).toBeGreaterThan(1));

    const first = screen.getAllByRole('option')[0];
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    const second = screen.getAllByRole('option')[1];
    expect(first?.getAttribute('aria-selected')).toBe('false');
    expect(second?.getAttribute('aria-selected')).toBe('true');
    expect(input.getAttribute('aria-activedescendant')).toBe(second?.id);
  });

  it('is focused by the / key from anywhere on the page', () => {
    renderShell(<SearchPill />);
    const input = screen.getByRole('combobox');
    expect(document.activeElement).not.toBe(input);
    fireEvent.keyDown(document.body, { key: '/' });
    expect(document.activeElement).toBe(input);
  });

  it('clears with Escape before closing', async () => {
    renderShell(<SearchPill />);
    const input = type('account');
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(input.value).toBe('');
  });

  it('explains an empty index instead of showing an empty box', async () => {
    vi.unstubAllGlobals();
    stubFetch({ '/api/p/agentos/graph': 'network-error' });
    renderShell(<SearchPill />);
    await waitFor(() => expect(fetch).toHaveBeenCalled());
    type('anything');
    await waitFor(() => expect(screen.getByText(/off the tailnet/i)).toBeTruthy());
  });
});
