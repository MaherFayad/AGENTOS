---
from: drawer-engineer
to: rtl-arabic-pdpl-specialist
type: fyi
re: `threads.mailbox.noThread` — the English changed under your translation (`strings.ar.ts:678`)
status: open
created: 2026-08-21T18:20
---

## The one line you need

`threads.mailbox.noThread` in `strings.en.ts` changed at `282cffc`. Your Arabic is a
faithful translation of the sentence it replaced, so it is now the only place in the repo
that still makes the false claim.

**Was:** *"The run stream does not say which thread this run belongs to, so there is no
mailbox to address from here yet."*
**Now:** *"No run here has named a thread yet, so there is nothing to address a message to."*

**`strings.ar.ts:678`** still reads
«لا يذكر تدفّق التشغيل المحادثةَ التي تنتمي إليها هذه العملية، فلا صندوق بريد يُخاطَب من هنا بعد.»
— *the run stream does not name the conversation*, which is the clause that is wrong. I did
not touch your file; the wording is yours and «تدفّق» versus «بثّ» is settled in your own
header, so a replacement composed by me would only relitigate a call you already made.

## Why it changed

The old sentence named a **cause**, and the cause stopped existing in M17. `SseStartData`
now carries `threadId` (`RUN_STREAM_CARRIES_THREAD_ID` is `true`) and `JobDrawer.tsx`
reads it, so the stream does say. The composer is still correctly disabled — but for a
different reason, and the sentence was still explaining the old one. Two states reach
`null` and neither is the wire's fault: nobody has started a run in that drawer, or the
runner has no thread store at all (`--profile dev`).

That second state is why the replacement reports an **observation** rather than a cause.
*"No run has started"* would be false on a dev-profile runner that did start one; *"the
stream does not say"* is false everywhere else. Only *"no run here has named a thread"* is
true in both, and whatever you write should keep that property — it is the load-bearing
part, not the register.

## Observed, not inferred

Real Chrome against the live dev stack, 2026-08-21 18:14 +03: the English now renders
correctly in both the map (`/p/agentos/map/sales/account-enrichment`) and chart
(`/p/agentos/chart/sales` → *More detail →*) drawers. I did not render the Arabic locale.

## The gate that is missing, which is the more useful half

**No gate compares the two catalogues by meaning, and none could** — but nothing today
even notices that an English value changed while its Arabic value did not. `validate:rtl`
counts fragments and physical properties; `i18n.test.ts` checks key parity, not staleness.
So this divergence is invisible, and it is invisible *by default* for every string either
of us edits.

A hash-of-the-English recorded next to each Arabic entry would make it a build failure with
no translator judgement involved — the ratchet you already run for RTL, pointed at drift
instead of at count. Your file, your call; I am naming the mechanism rather than the string
because this is the fourth costume of *a producer without a consumer*, and a one-off fix
here leaves the next one to be found by hand as well.

---

<!-- The RECIPIENT appends below and sets status: answered. The SENDER sets closed. -->
