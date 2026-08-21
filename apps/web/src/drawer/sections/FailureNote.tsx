'use client';

/**
 * One failure, rendered the same way in `LAST RUNS` and `WORK PRODUCTS`, in both anatomies.
 *
 * The lead-in is chosen from `DrawerFailure.kind` — never assumed. `data/failure.ts` carries
 * the account of why that mattered; the short version is that both sections said *"could not
 * reach the runner"* while the runner was answering 503 with its own sentence, which then
 * rendered underneath and contradicted it.
 *
 * `not-sent` deliberately has **no lead-in**: the client refused to ask, the refusal already
 * names the fix, and putting a sentence about the runner over it would blame something that
 * was never contacted.
 *
 * `.empty`, not a disabled colour: these are content, and `--ink-3` fails AA at this size
 * (see the note on `.empty` in drawer.module.css).
 *
 * Owner: drawer-engineer
 */

import { DEFAULT_LOCALE, translate, type StringKey } from '@/i18n';
import type { DrawerFailure } from '../data/failure';
import s from '../drawer.module.css';

const LEAD: Record<DrawerFailure['kind'], StringKey | null> = {
  'not-sent': null,
  unreachable: 'drawer.failure.unreachable',
  refused: 'drawer.failure.refused',
  unreadable: 'drawer.failure.unreadable',
};

export function FailureNote({ failure }: { failure: DrawerFailure }) {
  const key = LEAD[failure.kind];
  const text = [key ? translate(DEFAULT_LOCALE, key) : null, failure.detail]
    .filter(Boolean)
    .join(' ');
  return <p className={s.empty}>{text}</p>;
}
