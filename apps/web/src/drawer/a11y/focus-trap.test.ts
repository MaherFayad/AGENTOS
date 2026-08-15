import { describe, expect, it } from 'vitest';
import { keyIntent, nextIndex } from './focus-trap';

describe('focus-trap arithmetic', () => {
  it('maps Esc to close and Tab to cycle', () => {
    expect(keyIntent({ key: 'Escape', shiftKey: false })).toBe('close');
    expect(keyIntent({ key: 'Tab', shiftKey: false })).toBe('cycle-forward');
    expect(keyIntent({ key: 'Tab', shiftKey: true })).toBe('cycle-back');
    expect(keyIntent({ key: 'Enter', shiftKey: false })).toBeNull();
  });

  it('wraps at both ends and enters from outside at the first / last item', () => {
    expect(nextIndex(-1, 3, false)).toBe(0);
    expect(nextIndex(-1, 3, true)).toBe(2);
    expect(nextIndex(2, 3, false)).toBe(0);
    expect(nextIndex(0, 3, true)).toBe(2);
  });
});
