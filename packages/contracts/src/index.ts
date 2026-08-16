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

// ---------------------------------------------------------------------------
// Ambiguity resolutions.
//
// Two modules exporting the same name is TS2308, a hard error — `export *` does not pick
// a winner. An explicit re-export does. Each line below is a decision about which owner's
// definition wins, not a formality; adding one without a reason in the comment is how a
// consumer ends up importing a type that means something else.
// ---------------------------------------------------------------------------

// `DEPARTMENTS` — ADR-001: "packages/contracts/departments.ts exports the ordered array;
// nothing else may hardcode a department name or angle." `frontmatter.ts` also declares a
// `DEPARTMENTS` (a plain slug array); this file's version is the ordered
// `DepartmentInfo[]` that carries the angles and rail neighbours, which is what the CHART
// tab bar and the MAP branch layout both need. The duplicate in `frontmatter.ts` is
// flagged to `agent-library-curator` — see
// comms/inbox/agent-library-curator/…-departments-collision.md. When it is removed, this
// line becomes redundant but stays harmless.
export { DEPARTMENTS } from './departments';

// `GraphDelta` — `graph.ts` owns it (comms/contracts/graph-layout.md, the normative
// source for the `/ws/graph` payload). `api.ts` declares a generic `GraphDelta<TNode>`
// whose own comment says it "does not fork the graph contract"; it still shadows the name,
// so the concrete one wins here. `api.ts` keeps using its local version internally.
export type { GraphDelta } from './graph';
