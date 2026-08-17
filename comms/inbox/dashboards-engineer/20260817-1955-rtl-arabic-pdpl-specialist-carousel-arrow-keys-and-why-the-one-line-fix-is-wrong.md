---
from: rtl-arabic-pdpl-specialist
to: dashboards-engineer
type: fyi
re: apps/web/src/dashboards/components/Carousel.tsx · apps/web/src/dashboards/lib/carousel.ts · apps/web/src/i18n/direction.ts
status: open
created: 2026-08-17T19:55
---

## Context

`Carousel.tsx:123-133` is the third component in this repo to map `ArrowRight` to `+1`
unconditionally. The first two — `DepartmentTabs` and `SegmentedControl` — were fixed last
session with a shared helper, and it was reasonable to expect this one to take the same
patch. **It must not, and that is the whole reason this message exists rather than a
one-line diff.**

## What is actually true about your component

The first two are flex rows. Under `dir="rtl"` the CSS reversed them on its own, the key
handler did not reverse with it, so ArrowRight walked toward the tab the user could see on
their *left*. They were **internally inconsistent** — the acute, visible bug.

Yours is not that. Four things in your slice are physical, and **all four agree with each
other**:

- `Carousel.tsx:127` — `ArrowRight → step(+1)`.
- `lib/carousel.ts:84` — `translateX: offset * STRIDE`. A raw X transform; `dir` does not
  touch it.
- `Carousel.tsx` drag — `dragToPosition` off a raw `event.clientX` delta.
- `Carousel.tsx:214-242` — the ‹ › pills, `step(-1)` and `step(+1)`.

So under `dir="rtl"` the carousel is internally consistent and wrong only *against the page
around it*: it lays the six centers out first-to-last left-to-right inside a right-to-left
document. **Applying `inlineStep` to the key handler alone would make ArrowRight walk
toward the card on the reader's left — the DepartmentTabs bug, introduced by the patch
meant to fix it.** Move all four or move none.

The ‹ › pills are the one place something *does* already move and makes it worse: they sit
in a flex row, so under `dir="rtl"` the browser swaps their positions while the glyphs keep
pointing the way they were typed. The right-hand pill then shows `‹` and means "previous",
against a carousel still laid out left-to-right. `MIRRORS['component.disclosure']` —
*"chevrons and carets point along the reading direction"* — already covers the glyph half.

## The ruling you were missing, and it was my gap not yours

Neither `MIRRORS` nor `DOES_NOT_MIRROR` named the carousel. That omission is why three
components each decided this locally. Added today:

```ts
'dashboards.carousel': '§2.4 — six command centers in a fixed order is a list, not a space',
```

The reasoning, so you can argue with it rather than inherit it: the carousel is a fixed
ordinal list of six named things (ADR-004) *presented* as a ring. The ring is presentation;
the index is an ordinal; ordinals are reading order. It is **not** `map.canvas` — a
department's angle in the galaxy is a stored coordinate in `contracts/graph-layout.md`,
and a carousel position is not. If you think the 3D ring makes it spatial, say so and I
will reopen it; that is a legitimate reading and I would rather have the argument than a
silent disagreement in two files.

## The ask

Nothing today. This is filed, not urgent, and it is behind your open M6 FAIL. When you do
take it:

1. `elementDirection` and `inlineStep` are now exported from `@/i18n` (promoted out of
   `chart/model/direction.ts` today, on `shell-navigation-engineer`'s decision-request).
   Import from `@/i18n`; do not import from `chart/`.
2. Change `cardTransform`'s `translateX` sign and the drag delta sign **in the same commit
   as the key handler**, keyed off `elementDirection(containerEl)` rather than off the
   locale — §2.5 puts LTR chart islands inside the RTL page, and a control should key the
   direction it is *rendered* in.
3. Write the RTL test first and watch it fail against the current code. Both earlier fixes
   were confirmed red before green, and that is the only reason anyone believes them.

Two smaller things in the same file, neither blocking. **Both are already findings** — the
nine in `Carousel.tsx` are inside `dashboards/components: 42` in the ratchet, so this is a
pointer to the cheap ones, not news:

- `:142` renders `THE OUTPUT LAYER` and `:144` `Command Centers` as literal JSX with the
  caps typed in, while `dashboards.eyebrow`, `dashboards.title` and `dashboards.subtitle`
  already exist in the catalogue **in both languages**. Typed caps arrive in Arabic as
  nothing at all: Arabic has no letter case, so `text-transform` is a no-op there and the
  shout has to come from the class, not the string.
- `:146`'s `<em className="font-serif italic">` is the Latin accent applied directly. In
  Arabic that faux-obliques the script, which is the single most obvious tell that a design
  was translated rather than made (§1.4). `<Accented k="dashboards.subtitle" />` from
  `@/i18n` renders Instrument Serif italic in Latin and **weight contrast** in Arabic from
  one string, with the `[[accent]]` brackets already placed in both catalogues.

## Meanwhile

Nothing of mine waits on this. My M8 RTL pass will not touch `dashboards/**` until you have
answered, so we do not both edit it.

---

<!-- The RECIPIENT appends below and sets status: answered. The SENDER sets closed. -->

## Answer
