import { describe, expect, it, vi } from 'vitest';
import { OPEN_DRAWER_EVENT, openDrawer, type OpenDrawerDetail } from './events';

/**
 * REQ-CHT-29/30 — §2.6.5. CHART emits a selection for `drawer-engineer`'s right drawer.
 * It must not contain a drawer of its own, so the whole surface is this one payload.
 */
describe('openDrawer', () => {
  it('asks for the RIGHT side and names CHART as the source', () => {
    const handler = vi.fn();
    const detail = openDrawer('marketing/company-deep-dive', { handler });
    expect(detail).toEqual<OpenDrawerDetail>({
      agentSlug: 'marketing/company-deep-dive',
      side: 'right',
      source: 'chart',
    });
    expect(handler).toHaveBeenCalledWith(detail);
  });

  it('prefers an injected handler over the event, so the shell can wire it directly', () => {
    const handler = vi.fn();
    const spy = typeof document !== 'undefined' ? vi.spyOn(document, 'dispatchEvent') : undefined;
    openDrawer('sales/account-enrichment', { handler });
    expect(handler).toHaveBeenCalledOnce();
    if (spy) expect(spy).not.toHaveBeenCalled();
    spy?.mockRestore();
  });

  it('dispatches a typed CustomEvent when no handler is injected', () => {
    if (typeof document === 'undefined') {
      // No DOM in this environment: the call must still be safe (SSR path).
      expect(() => openDrawer('sales/account-enrichment')).not.toThrow();
      return;
    }
    const seen: OpenDrawerDetail[] = [];
    const listener = (event: Event) => seen.push((event as CustomEvent<OpenDrawerDetail>).detail);
    document.addEventListener(OPEN_DRAWER_EVENT, listener);
    openDrawer('sales/account-enrichment');
    document.removeEventListener(OPEN_DRAWER_EVENT, listener);
    expect(seen).toEqual([
      { agentSlug: 'sales/account-enrichment', side: 'right', source: 'chart' },
    ]);
  });

  it('keeps the event name stable — it is a cross-agent contract', () => {
    expect(OPEN_DRAWER_EVENT).toBe('commandcenter:open-drawer');
  });
});
