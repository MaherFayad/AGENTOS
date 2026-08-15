import { fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HelpSheet } from './HelpSheet';
import { renderShell, stubFetch } from './test-harness';

vi.mock('next/navigation', async () => (await import('./test-harness')).navigationMock());
vi.mock('./ui', async () => (await import('./test-harness')).uiMock());

beforeEach(() => stubFetch({}));
afterEach(() => vi.unstubAllGlobals());

describe('HelpSheet', () => {
  it('is closed until asked for', () => {
    renderShell(<HelpSheet />);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('opens on ? and closes on Escape', async () => {
    renderShell(<HelpSheet />);
    fireEvent.keyDown(document.body, { key: '?' });
    await waitFor(() => expect(screen.getByRole('dialog')).toBeTruthy());
    fireEvent.keyDown(document.body, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('teaches the keyboard path into the canvas', async () => {
    renderShell(<HelpSheet />);
    fireEvent.keyDown(document.body, { key: '?' });
    await waitFor(() => expect(screen.getByRole('dialog')).toBeTruthy());
    expect(screen.getByText(/Focus search/i)).toBeTruthy();
  });

  it('explains why there is no sign-in (§3.6)', async () => {
    renderShell(<HelpSheet />);
    fireEvent.keyDown(document.body, { key: '?' });
    await waitFor(() => expect(screen.getByText(/no sign-in/i)).toBeTruthy());
    expect(screen.getByText(/Tailscale network/i)).toBeTruthy();
  });
});
