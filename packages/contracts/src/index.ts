/**
 * @agnetos/contracts — the code half of `comms/contracts/`.
 *
 * ADR-002: "the prose contract is normative, the TypeScript is generated-by-hand from
 * it, and the validators check that they agree. Both web and runner import it; neither
 * redefines it."
 *
 * Each module below has exactly one owning agent, named in its header comment. If you
 * need a shape changed, file a `decision-request` to that owner — do not edit a file you
 * do not own (comms/README.md rule 2).
 */

// Extensionless specifiers: this package ships TypeScript source (no build step), so the
// consumer's bundler (Next) or runtime transpiler (tsx) resolves these.
export * from './departments';
export * from './frontmatter';
export * from './graph';
export * from './api';
export * from './panels';
export * from './project';
// `thread-model-engineer`, ADR-023. Exports nothing that any module above declares — checked
// rather than assumed, because `export *` does not pick a winner and a collision is TS2308.
export * from './threads';
// `scheduler-engineer`, ADR-024. Declares no runtime name any module above declares — checked by
// `check-barrel-exports.mjs`, not assumed, because `export *` picks no winner and the last
// duplicate this barrel carried white-screened every route while `next build` exited 0.
export * from './scheduling';
// `runner-engineer`, ADR-026 (M17, `Plan §13`). **Types only — it exports no runtime value at
// all**, so it cannot collide with a starred module above in the way ADR-035 describes. Named
// here rather than folded into `api.ts` because the diff payload has one author and one prose
// contract (`comms/contracts/work-product.md`), and a shape with two homes acquires two.
export * from './work-product';

// ---------------------------------------------------------------------------
// Ambiguity resolutions — and the one rule that governs them (ADR-035).
//
// **A VALUE exported by two starred modules is a defect, not something to resolve here.**
// An explicit re-export makes TypeScript stop complaining, and that is the entire trap:
// `tsc --noEmit` goes clean while Next's `optimizePackageImports` barrel optimizer, which
// resolves the wildcards *separately* from the explicit re-export, hits the duplicate,
// gives up on the whole barrel, and hands every client component `undefined` for every
// named import from this package. That is not theoretical — `DEPARTMENTS` was declared in
// both `departments.ts` and `frontmatter.ts` with a comment here calling the duplicate
// "harmless", and it white-screened all four views for as long as it existed. `next build`
// exited 0 the whole time. Fix the duplicate at its source; do not add a line below.
//
// `scripts/check-barrel-exports.mjs` enforces this and runs in CI.
//
// TYPES are different, and only because they are erased: `export type { … }` emits no
// runtime binding, so no bundler ever sees two of them. A type resolution here is a real
// decision about which owner's definition consumers get, and needs its reason stated.
// ---------------------------------------------------------------------------

// `GraphDelta` — `graph.ts` owns it (comms/contracts/graph-layout.md, the normative
// source for the `/ws/graph` payload). `api.ts` declares a generic `GraphDelta<TNode>`
// whose own comment says it "does not fork the graph contract"; it still shadows the name,
// so the concrete one wins here. `api.ts` keeps using its local version internally.
// Type-only on both sides, so it is erased before any bundler runs.
export type { GraphDelta } from './graph';
