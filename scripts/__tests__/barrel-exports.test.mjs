/**
 * check-barrel-exports.mjs — the gate that would have caught the 2026-08-17 outage.
 *
 * The regression this file exists for is not a subtle one. `DEPARTMENTS` was declared in
 * both `packages/contracts/src/departments.ts` and `.../frontmatter.ts`, both star-exported
 * from `index.ts`. Next's `optimizePackageImports` barrel optimizer hit the duplicate,
 * discarded the entire barrel, and every named import from `@agnetos/contracts` in a client
 * component became `undefined` — a white screen on all four views. `tsc --noEmit` was clean,
 * `next build` exited 0, and every test in the repo was green throughout. ADR-035.
 *
 * The last test reads the **real** `index.ts`, so the collision cannot come back without a
 * red test rather than only without a careful reviewer.
 *
 * Two of the tests below assert on `runtimeExportsOf` finding a *non-zero* number of things.
 * That is deliberate: the first version of this checker blanked string literals before
 * matching, which deleted every `from './x'` specifier, so it scanned zero modules and
 * reported "no duplicate runtime name" — a green result over an empty set. That is the
 * defect class BOARD calls a plausible zero about the measurement, and it was found by
 * planting the collision rather than by reading the checker.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { checkBarrels, runtimeExportsOf } from '../check-barrel-exports.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const CONTRACTS = join(ROOT, 'packages', 'contracts', 'src');

test('a value declaration is a runtime export', () => {
  const { names } = runtimeExportsOf(
    ['export const A = 1;', 'export function b() {}', 'export class C {}', 'export enum D { x }'].join('\n'),
  );
  assert.deepEqual([...names].sort(), ['A', 'C', 'D', 'b']);
});

test('a type-only declaration is not — it is erased before any bundler sees it', () => {
  const { names } = runtimeExportsOf(
    ['export type A = string;', 'export interface B { x: 1 }', "export type { C } from './c';"].join('\n'),
  );
  assert.deepEqual([...names], []);
});

test('`export { x as y }` exports y; an inline `type` specifier exports nothing', () => {
  const { names } = runtimeExportsOf("export { a as b, type C, d } from './m';");
  assert.deepEqual([...names].sort(), ['b', 'd']);
});

test('`export * from` is followed; `export * as ns from` binds one name instead', () => {
  const { names, starTargets } = runtimeExportsOf("export * from './a';\nexport * as ns from './b';");
  assert.deepEqual(starTargets, ['./a']);
  assert.deepEqual([...names], ['ns']);
});

test('a name that appears only in a comment or a string is not a declaration', () => {
  const { names } = runtimeExportsOf(
    ['// export const FromALineComment = 1;', '/* export const FromABlockComment = 1; */', 'const s = "export const FromAString = 1;";'].join('\n'),
  );
  assert.equal(names.size, 0);
});

test('module specifiers survive comment stripping — the checker must not scan an empty set', () => {
  // The literal defect: blanking string contents deleted every `from './x'`, so the walk
  // found zero star targets and passed over nothing.
  const { starTargets } = runtimeExportsOf("/* a comment */\nexport * from './departments';\nexport * from './frontmatter';");
  assert.deepEqual(starTargets, ['./departments', './frontmatter']);
});

test('the real @agnetos/contracts barrel has no duplicate runtime name', async () => {
  const failures = await checkBarrels([join(CONTRACTS, 'index.ts')]);
  assert.deepEqual(failures, [], failures.join('\n'));
});

test('the department enum is declared exactly once, in departments.ts (ADR-001, ADR-035)', async () => {
  const declares = async (file) =>
    /^export const DEPARTMENT(S|_SLUGS|_LABELS)\b/m.test(await readFile(join(CONTRACTS, file), 'utf8'));
  assert.equal(await declares('departments.ts'), true, 'departments.ts must own the enum');
  assert.equal(await declares('frontmatter.ts'), false, 'frontmatter.ts must not re-declare it');
});
