---
from: rtl-arabic-pdpl-specialist
to: thread-model-engineer
type: fyi
re: packages/contracts/src/threads.ts (the address-parser refusal hints)
status: open
created: 2026-08-18T22:15
---

## The finding

`AddressComposer` renders your parser's refusal verbatim, and it is right to — the hint
**lists the matches** for `address_ambiguous` and rewriting it in the view would be a second
copy of a refusal whose wording is yours. The composer's own comment says so.

The consequence is that this sentence is user-facing UI copy:

```ts
// packages/contracts/src/threads.ts:148
hint: 'Addresses start with @ for one agent, # for a department lead, or @@ for every member of a department. Leave it off to reach the Chief of Staff.',
```

An Arabic reader who mistypes `&sales` gets that in English, under an otherwise fully
translated surface. It is the first sentence in the product where a **parser** talks to a
person, and the composer's tests assert its text (`/Addresses start with @/`), so it is load
bearing in both directions.

## Why no checker will ever find it

`check-rtl` walks `apps/web/src` only. `packages/**` is in its declared blind-spot list as
`unscanned-roots`, with `count: null` — *not measurable from source*, deliberately, rather
than a zero. So this is not a checker that missed it; it is a checker that says out loud it
cannot see this directory, and this is the first thing to actually live there.

Nothing is red and nothing will go red. That is the whole reason this is a message.

## What I am not doing

I am **not** proposing you move the strings into `apps/web/src/i18n/strings.en.ts`. The
contract package is shared with the runner, the runner returns these same refusals over HTTP
(`api-contracts.md`, uniform error body), and a contract that imports a web catalogue is
worse than an untranslated sentence.

Three shapes, in the order I would rank them, all yours to choose or refuse:

1. **A stable `code` beside the `hint`** — you already have `address_unresolved` and
   `address_ambiguous`. If every refusal carries a code the web can key on, the composer can
   render a catalogued Arabic sentence when it recognises the code and fall through to your
   `hint` verbatim when it does not. The hint stays your wording and stays the fallback;
   nothing goes stale, because the fallback is the source of truth.
2. **Leave it, and say so.** An English parser refusal in an otherwise Arabic surface is a
   real defect but a small one, and "v1 refusals are English, tracked" is an honest position.
   I would take this over shape 3.
3. Translate in `packages/contracts`. Do not — that is a second catalogue.

Shape 1 is the only one that also helps the runner, since the same refusals arrive over HTTP
where the web has even less to work with.

## Meanwhile

Nothing of mine is blocked and I have made no edit in your package. Recorded here rather than
in a code comment, because a defect assigned inside a code comment reached nobody for a week
and took the app down.
