'use client';

/**
 * Why a dead control is dead, **on the screen**, not in a `title`.
 *
 * ## The finding
 *
 * This build wrote a specific, correct, human sentence for every disabled control and then
 * hid sixteen of eighteen of them. They lived in `title` plus a 1×1 `sr-only` span, which
 * reaches a mouse that hovers for a second and a screen reader, and **nobody else**:
 *
 *   - `title` never opens on touch, and §3.6 makes the phone the reason the PWA exists;
 *   - `title` does not open on keyboard focus in any browser either — measured with real
 *     `Input.dispatchKeyEvent` Tab presses through the map drawer, the carrier span took
 *     focus and drew its monochrome ring and said nothing at all;
 *   - so on the chart panel, eighteen controls, sixteen disabled, and on screen it is a wall
 *     of grey buttons with no words.
 *
 * The effect is to convert *"the API key isn't set"* into *"this app is broken"* — the exact
 * misreading rule 9 exists to prevent, in the one place this build broke its own rule. The
 * correct treatment already existed 200 lines away on `Approve` / `Request changes`.
 *
 * ## Why a list and not one sentence
 *
 * Because the reasons are not all the same kind of fact. On the chart drawer's SKILLS cards,
 * three `▶ Run` buttons are disabled because *"only a full agent can be run on its own"* —
 * a permanent property of a sub-skill that never turns on — while `Download ⬇` is disabled
 * because a route is not agreed yet. Collapsing them into one line would say "the runner is
 * down" about four buttons that stay disabled with it up. So reasons are collected, deduped
 * in the order they were offered, and each renders once.
 *
 * ## What this deliberately does not do
 *
 * It does not enable anything and it does not soften anything. A disabled control with an
 * honest visible reason is the M2 rule (*don't ship a fake ▶ that does nothing*) finally kept
 * on both sides of the glass.
 *
 * Owner: drawer-engineer
 */

import { useId } from 'react';
import s from '../drawer.module.css';

export interface InertReason {
  id: string;
  text: string;
}

export interface InertReasons {
  /** Deduped, in offer order. Empty when every control is live — nothing then renders. */
  notes: InertReason[];
  /** The id of the paragraph carrying this reason, for `aria-describedby`. */
  idFor: (reason: string | null | undefined) => string | undefined;
}

/**
 * `useId` and not a hand-written id: `SkillCards` renders one of these per card, and the two
 * hardcoded ids this replaces (`drawer-run-disabled-reason`) were one duplicated card away
 * from being invalid HTML with every button pointing at the first copy.
 */
export function useInertReasons(reasons: ReadonlyArray<string | null | undefined>): InertReasons {
  const base = useId();
  // Not memoized, on purpose. The first draft memoized on `reasons.join(' ')` and then rebuilt
  // the list by splitting that key back apart on spaces, which shreds every sentence into
  // words and renders one paragraph per word. Three strings and an `indexOf` per render is
  // cheaper than the cache that made that reachable.
  const seen: string[] = [];
  for (const reason of reasons) {
    if (reason && !seen.includes(reason)) seen.push(reason);
  }
  const notes = seen.map((text, index) => ({ id: `${base}reason${index}`, text }));
  return {
    notes,
    idFor: (reason) => {
      if (!reason) return undefined;
      const index = seen.indexOf(reason);
      return index === -1 ? undefined : notes[index]?.id;
    },
  };
}


/**
 * `.sectionNote` is the class this build already uses for a sentence the reader has to act on
 * (the schema-gap disclosure, the schedule reply). It is `--ink-2`, not the disabled `--ink-3`
 * — an explanation is content, and `--ink-3` measures 3.57:1 at this size.
 */
export function InertReasonNotes({ notes }: { notes: InertReason[] }) {
  if (notes.length === 0) return null;
  return (
    <>
      {notes.map((note) => (
        <p className={s.sectionNote} id={note.id} key={note.id}>
          {note.text}
        </p>
      ))}
    </>
  );
}
