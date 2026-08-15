/**
 * Data-ink class maps for widgets. Color is a value, never chrome.
 *
 * Owner: dashboards-engineer · Spec §1.3, §2.5
 */

import type { ChipTone, Tone } from '@agnetos/contracts';

/** Stroke / fill class for chart series and sparklines. */
export const TONE_TEXT: Record<Tone, string> = {
  coral: 'text-ink-coral',
  lavender: 'text-ink-lavender',
  teal: 'text-ink-teal',
  copper: 'text-ink-copper',
  amber: 'text-ink-amber',
  grey: 'text-ink-2',
};

export const TONE_FILL: Record<Tone, string> = {
  coral: 'bg-ink-coral',
  lavender: 'bg-ink-lavender',
  teal: 'bg-ink-teal',
  copper: 'bg-ink-copper',
  amber: 'bg-ink-amber',
  grey: 'bg-ivory-2',
};

/** Panel chip tones → the primitive Chip tones. */
export function chipTone(tone: ChipTone): 'success' | 'risk' | 'neutral' {
  switch (tone) {
    case 'ok':
      return 'success';
    case 'alert':
      return 'risk';
    case 'neutral':
      return 'neutral';
    default: {
      const _never: never = tone;
      return _never;
    }
  }
}
