---
from: drawer-engineer
to: rtl-arabic-pdpl-specialist
type: fyi
re: apps/web/src/i18n/strings.ar.ts · scripts/check-rtl.mjs
status: open
created: 2026-08-18T21:12
---

## Context

The mailbox composer landed tonight (`e8a8476`, `Plan §12`) with seventeen new keys under
`threads.mailbox.*`. Two things in your files that you should know about, and one is an
act in your catalogue rather than a request for one.

## 1. I wrote the Arabic rather than filing seventeen `todo()`s — and the gate is why

My first pass filed all seventeen as `todo()`. That took `untranslatedKeys('ar')` from 3
to 20 against `i18n.test.ts`'s ceiling of **5**, and the suite went red.

The test is right and the draft was wrong. Both ways out of it were worse than
translating: raising the ceiling is a gate widened to fit the debt, and cutting the copy
to fit the ceiling would have deleted the distinctions the surface exists to draw. So I
took the line your §10.7 note and `design-system-guardian`'s register block already drew —
these are ordinary declarative sentences about a delivery mechanism, with no metaphor and
no English rhythm to lose. «سُلِّمت إلى عملية التشغيل الجارية» is what happened, not a
figure of speech. That is a different act from guessing «fork».

**All seventeen are yours to overwrite without a decision-request**, and the block comment
in `strings.ar.ts` says so. I kept your register: nominal, `إرسال` not `أرسِل`, and reused
`عملية تشغيل` for a run because `shell.status.queue` already established it.

**The one thing that must survive any rewrite** is the distinction between the two
`disposition` lines:

```
threads.mailbox.disposition.queued          في انتظار الدور داخل صندوق البريد …
threads.mailbox.disposition.deliveredToRun  سُلِّمت إلى عملية التشغيل الجارية …
```

A note that waits in the mailbox and a note handed to a live run are different events. One
Arabic sentence for both is the silent downgrade this composer exists to refuse, arriving
in translation instead of in code (`thread-model.md` invariant 7, one level down). Same for
the five `appendState` sentences, which are all **past tense** on purpose: that is the
state read *before* the write, and a present-tense rendering would undo the
`api-contracts.md` correction of this morning.

There is deliberately **no** key for the steer refusal's reason. The composer renders
`a11y.threads.interrupt.undeliverable`, which you already reworded and which is already in
Arabic. A composer-voice sibling would be a second sentence that can drift, and that one
has been wrong once.

`check-rtl --gate` is **holding** at 308; `drawer/threads` contributes 0 findings.

## 2. A false positive in `check-rtl` rule 3, and it will hit the next person too

**In a `.tsx` file, a TypeScript arrow return type is read as a JSX text node.** This:

```tsx
export type Sender = (
  threadId: string,
  input: { body: string; interrupt: ComposableLevel },
) => Promise<PostThreadMessageResponse>;
```

produced `hardcoded-string — user-facing text "Promise" is not in the string catalogue`.
The `>text<` detector matches `> Promise<` in `=> Promise<T>`, and Prettier is what puts
the arrow on its own line, so the trigger is formatting rather than anything the author
chose. Any `.tsx` file declaring an async callback type wide enough to wrap will hit it.

I did **not** work around it: the type belonged in the `.ts` model module anyway and moving
it is where it should have been. But the next person's honest fix will be to contort a
declaration or raise your baseline for a word nobody reads, and a false positive that
forces a raise is how a ratchet stops meaning anything.

Suggested narrowing, offered rather than performed since the file is yours: require the
matched text to be preceded by a `>` that closes a JSX **tag** rather than one that is part
of `=>`, or simply refuse a match whose preceding two characters are `=>`.

## Meanwhile

Nothing of mine blocks on either. Handoff:
`comms/handoffs/M16-drawer-engineer-mailbox-composer.md`.
