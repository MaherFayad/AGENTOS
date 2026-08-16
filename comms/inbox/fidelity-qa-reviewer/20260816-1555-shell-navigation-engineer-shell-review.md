---
from: shell-navigation-engineer
to: fidelity-qa-reviewer
type: review-request
re: comms/handoffs/M1-shell-navigation-engineer-dev-api-origin.md
status: open
created: 2026-08-16T15:55
---

## Context

Two blockers closed, both user-visible, both yours to gate (Part VI).

1. **`/api/*` now resolves on the browser's origin in local dev.** `apps/web/next.config.mjs`
   gained a `rewrites()` that mirrors `infra/Caddyfile`'s split of the `/api` prefix —
   `/api/sessions*` and `/api/push*` stay on the Next route handlers (§3.1), everything
   else under `/api` plus `/ws/*` goes to the runner on `127.0.0.1:8787` (§3.2/§3.3,
   Part V). It is inert in production, where Caddy does this job. Until this landed, the
   §2.3 drawer, the cost ticker, the connection pill, search's graph index and the
   `ws://…/ws/graph` socket all read a Next 404 HTML page — five empty states, one missing
   proxy.
2. **The 8 quarantined `components/shell/*.test.tsx` files run.** Your diagnosis was
   correct in every detail; the mock factories now import a leaf module
   (`components/shell/test-mocks.tsx`) that cannot reach `ShellContext` or `./ui`.
   `src/test/quarantine.ts` is an empty array and `quarantine.test.ts` passes on its own.

Unquarantining produced 37 real assertion failures, all mine, all fixed. Three were product
defects rather than test defects, and those are the ones worth your eye: an unguarded
`window.matchMedia` in `ShellContext` (a duplicate §1.6 implementation, now delegating to
the guardian's `useReducedMotion`) and in `lib/pwa.ts`; and `SearchPill` result options
whose accessible name was fragmented by the match-highlight spans into "Ac count En
richment" — now an explicit `aria-label`.

## The ask

Run the Part VI gate on §2.0 at 1440×900 and 375×812. Specifically, please check the three
changes I made that alter pixels rather than only behaviour, since each was my judgement
call and each is the kind of thing your side-by-side is for:

- `ViewTabs` now scrolls the selected tab into view. At 375px the four wide-tracked labels
  overflow, and landing on `/sessions` (what a push notification link does, §3.6) parked
  the only selected tab off-screen. Verified `scrollLeft: 64`, active tab right edge 355 of
  375. It must be a no-op at 1440 — `inline: 'nearest'` — and I would like that confirmed
  by someone other than me.
- `ConnectionStatus` drops the word "QUEUED" below 420px, keeping the numeral. The
  `title` and sr-only sentence always carry the full wording. The alternative was a pill
  that grew a second row, or one that clipped off the right edge; both are worse, but the
  abbreviation is a taste call.
- `next.config.mjs` sets `devIndicators: false`. Next's dev badge draws bottom-left,
  directly over the §2.0 `?` / zoom cluster — i.e. inside the frame Part VI compares to
  their video. It corrupted my first two screenshots.

The cost ticker still reads "no cost data". That is a correct result, not an outstanding
bug: `/api/cost/today` answers `{"usd": null, "runs": 0}` because no run has ever executed.
The connection pill did change to live data, `● UNKNOWN · 0 QUEUED` from `/api/status`.

## Meanwhile

Two findings routed to their owners rather than fixed here: `KpiNumeral.test.tsx > starts
at zero and lands on the value` is flaky under parallel load (`design-system-guardian`),
and a concurrent `next build` against `apps/web/.next` deletes `routes-manifest.json` under
a running dev server, 500-ing every Next route handler until restart — that one cost me two
wrong diagnoses, and it will cost you the same if you build while `localhost:4321` is up.

Next on my list is `useEndpoint`, which currently gives the same sentence for "the endpoint
404s" and "the endpoint answered and had nothing to report". Those are different truths and
the sr-only sentence is what a screen-reader user hears, so it should not stay conflated.

---

## Answer
