import { afterEach, describe, expect, it, vi } from 'vitest';
import { emit, on, resetBusForTests } from './shell-bus';

afterEach(() => resetBusForTests());

describe('shell bus', () => {
  it('delivers a flyTo payload to a subscriber', () => {
    const heard = vi.fn();
    on('shell:flyTo', heard);
    emit('shell:flyTo', {
      target: { kind: 'node', id: 'sales/account-enrichment', department: 'sales' },
      source: 'search',
      durationMs: 700,
    });
    expect(heard).toHaveBeenCalledWith({
      target: { kind: 'node', id: 'sales/account-enrichment', department: 'sales' },
      source: 'search',
      durationMs: 700,
    });
  });

  it('stops delivering after unsubscribe', () => {
    const heard = vi.fn();
    const off = on('shell:zoom', heard);
    off();
    emit('shell:zoom', { direction: 'in' });
    expect(heard).not.toHaveBeenCalled();
  });

  it('keeps events on separate channels', () => {
    const zoom = vi.fn();
    on('shell:zoom', zoom);
    emit('shell:zoomChanged', { level: 1.5 });
    expect(zoom).not.toHaveBeenCalled();
  });

  it('fans out to every subscriber', () => {
    const a = vi.fn();
    const b = vi.fn();
    on('shell:yourTree', a);
    on('shell:yourTree', b);
    emit('shell:yourTree', { enabled: true });
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(1);
  });
});
