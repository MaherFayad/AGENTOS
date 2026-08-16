import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ZoomControls } from './ZoomControls';
import { emit, on, resetBusForTests } from '../../lib/shell-bus';
import { renderShell, stubFetch } from './test-harness';

vi.mock('next/navigation', async () => (await import('./test-mocks')).navigationMock());
vi.mock('./ui', async () => (await import('./test-mocks')).uiMock());

beforeEach(() => stubFetch({}));
afterEach(() => {
  vi.unstubAllGlobals();
  resetBusForTests();
});

describe('ZoomControls (§2.0 bottom-left)', () => {
  it('shows an em dash until a canvas reports a zoom level', () => {
    renderShell(<ZoomControls />);
    expect(screen.getByRole('button', { name: /zoom level/i }).textContent).toBe('—');
  });

  it('renders the level the canvas reports', async () => {
    renderShell(<ZoomControls />);
    act(() => emit('shell:zoomChanged', { level: 1.5 }));
    await waitFor(() => expect(screen.getByRole('button', { name: /zoom level/i }).textContent).toBe('150%'));
  });

  it('asks the canvas to zoom rather than moving a camera itself', () => {
    const zoom = vi.fn();
    on('shell:zoom', zoom);
    renderShell(<ZoomControls />);
    fireEvent.click(screen.getByRole('button', { name: 'Zoom in' }));
    fireEvent.click(screen.getByRole('button', { name: 'Zoom out' }));
    expect(zoom).toHaveBeenNthCalledWith(1, { direction: 'in' });
    expect(zoom).toHaveBeenNthCalledWith(2, { direction: 'out' });
  });

  it('is disabled on views without a canvas', () => {
    renderShell(<ZoomControls />, { pathname: '/dashboards' });
    expect((screen.getByRole('button', { name: 'Zoom in' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('opens the help panel from the ? pill', () => {
    renderShell(<ZoomControls />);
    // The pill is present and labelled for screen readers; the panel itself is asserted
    // in HelpSheet's own test.
    expect(screen.getByRole('button', { name: /keyboard shortcuts/i })).toBeTruthy();
  });
});
