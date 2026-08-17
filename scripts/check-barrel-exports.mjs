#!/usr/bin/env node
/**
 * check-barrel-exports — no two `export *` modules in a barrel may export the same
 * runtime name.
 *
 * ADR-035. Owner: `agent-library-curator`.
 *
 * ## Why this exists, in one paragraph
 *
 * `packages/contracts/src/index.ts` is a barrel of `export * from './x'` lines, and
 * `apps/web/next.config.mjs` lists `@agnetos/contracts` in `optimizePackageImports`. When
 * two starred modules export the same *runtime* name, Next's barrel optimizer resolves the
 * wildcards separately from any explicit re-export, hits the conflict, and **discards the
 * entire barrel** — so every named import from the package in a client component resolves
 * to `undefined`. On 2026-08-17 that was `DEPARTMENTS`, declared in both `departments.ts`
 * and `frontmatter.ts`, and it white-screened all four views.
 *
 * The reason this needs its own checker rather than a code review is that **nothing else
 * in the repo can see it**:
 *
 *   - `tsc --noEmit` — clean. TypeScript resolves the barrel correctly, and an explicit
 *     `export { X } from './winner'` silences TS2308 outright. That silencing is the trap:
 *     it makes the source look decided while the bundler still fails.
 *   - `next build` — **exit 0**, no warning in the log. Verified, not assumed.
 *   - every unit test — green. Vitest and `node --test` import the TypeScript directly and
 *     never run the barrel optimizer.
 *
 * So the invariant is enforced here, at the only place it is cheap: the source of the
 * barrel. It runs in milliseconds and needs no build.
 *
 * ## What counts as a "runtime name"
 *
 * `export interface`, `export type` and `export type { … }` are erased before any bundler
 * sees them, so two modules may safely export the same *type* name — `index.ts` resolves
 * one of those deliberately (`GraphDelta`). Values cannot be resolved that way and this
 * checker refuses them.
 *
 * Usage:  node scripts/check-barrel-exports.mjs [barrel.ts …]
 * Exit 0 = clean. Exit 1 = at least one collision. Exit 2 = could not read a file.
 */

import { readFile } from 'node:fs/promises';
import { existsSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** Barrels we police by default. Add one here when a package grows an `index.ts`. */
const DEFAULT_BARRELS = [join(ROOT, 'packages', 'contracts', 'src', 'index.ts')];

/**
 * Strip comments, and optionally string/template literal *contents*, so a name inside
 * prose is never mistaken for a declaration.
 *
 * Deliberately ordered line-comments-first: doing block comments first lets a `/*` inside
 * a `//` line swallow the rest of the file, which is a defect this repo has already paid
 * for once (BOARD, `identity-model.test.mjs`).
 *
 * `keepStrings` exists because of a defect in the first version of this file, caught by
 * planting the collision it was written to catch: blanking string literals also blanked
 * every `from './x'` specifier, so the checker found **zero** star targets and reported
 * "no duplicate runtime name" over an empty set. A green assertion over nothing. Module
 * specifiers are matched against `keepStrings: true`; declarations against `false`.
 */
function stripNoise(src, keepStrings = false) {
  let out = '';
  let i = 0;
  const n = src.length;
  while (i < n) {
    const c = src[i];
    const next = src[i + 1];
    if (c === '/' && next === '/') {
      while (i < n && src[i] !== '\n') i++;
      continue;
    }
    if (c === '/' && next === '*') {
      i += 2;
      while (i < n && !(src[i] === '*' && src[i + 1] === '/')) i++;
      i += 2;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') {
      const quote = c;
      const start = i;
      i++;
      while (i < n && src[i] !== quote) {
        if (src[i] === '\\') i++;
        i++;
      }
      i++;
      out += keepStrings ? src.slice(start, i) : ' ';
      continue;
    }
    out += c;
    i++;
  }
  return out;
}

/**
 * Runtime export names declared by one module, plus the `export * from` targets it adds.
 *
 * Type-only forms are excluded by construction rather than by a negative lookahead, so a
 * new TypeScript-only keyword defaults to "not a runtime export" — the safe direction for
 * a checker whose false positives block a build.
 */
export function runtimeExportsOf(source) {
  const src = stripNoise(source);
  /** Same source with literals intact — the only view in which `from './x'` survives. */
  const withSpecifiers = stripNoise(source, true);
  /** @type {Set<string>} */
  const names = new Set();
  /** @type {string[]} */
  const starTargets = [];

  // export const X / export let X / export var X
  for (const m of src.matchAll(/^\s*export\s+(?:const|let|var)\s+([A-Za-z_$][\w$]*)/gm)) names.add(m[1]);
  // export function X / export async function X / export function* X
  for (const m of src.matchAll(/^\s*export\s+(?:async\s+)?function\s*\*?\s*([A-Za-z_$][\w$]*)/gm)) names.add(m[1]);
  // export class X — including `export abstract class`, which is still a runtime binding
  for (const m of src.matchAll(/^\s*export\s+(?:abstract\s+)?class\s+([A-Za-z_$][\w$]*)/gm)) names.add(m[1]);
  // export enum X / export const enum X — both emit an object unless `isolatedModules`
  // erases them, and "unless" is not a basis for a bundler-safety check.
  for (const m of src.matchAll(/^\s*export\s+(?:const\s+)?enum\s+([A-Za-z_$][\w$]*)/gm)) names.add(m[1]);

  // export { a, b as c } [from '…'] — but NOT `export type { … }`, which is erased.
  for (const m of withSpecifiers.matchAll(/^\s*export\s+(?!type\s*\{)\{([^}]*)\}(?:\s*from\s*['"]([^'"]+)['"])?/gm)) {
    for (const raw of m[1].split(',')) {
      const spec = raw.trim();
      if (!spec) continue;
      // `type Foo` / `type Foo as Bar` inside the braces is an inline type specifier.
      if (/^type\s/.test(spec)) continue;
      const as = /\bas\s+([A-Za-z_$][\w$]*)\s*$/.exec(spec);
      names.add(as ? as[1] : spec.split(/\s+/)[0]);
    }
  }

  // export * from './x' — a target to follow. `export * as ns from` binds one name and
  // cannot collide with another module's members, so it is recorded as a name, not a star.
  for (const m of withSpecifiers.matchAll(/^\s*export\s+\*\s*(?:as\s+([A-Za-z_$][\w$]*)\s+)?from\s*['"]([^'"]+)['"]/gm)) {
    if (m[1]) names.add(m[1]);
    else starTargets.push(m[2]);
  }

  return { names, starTargets };
}

/** Resolve an extensionless relative specifier the way this repo's bundlers do. */
function resolveSpecifier(fromFile, spec) {
  if (!spec.startsWith('.')) return null; // a package import is not part of this barrel
  const base = resolve(dirname(fromFile), spec);
  for (const candidate of [base, `${base}.ts`, `${base}.tsx`, join(base, 'index.ts')]) {
    try {
      if (statSync(candidate).isFile()) return candidate;
    } catch {
      /* not this one */
    }
  }
  return null;
}

/**
 * Walk one barrel. Returns `{ collisions, explicitValueReExports, visited }`.
 *
 * `explicitValueReExports` is reported separately and just as loudly: an explicit
 * `export { X } from './winner'` beside a star collision is precisely the fix that
 * compiles and still breaks the bundle, so a checker that only counted collisions would
 * go green on the exact workaround it exists to prevent.
 */
async function auditBarrel(barrelPath) {
  const barrelSrc = await readFile(barrelPath, 'utf8');
  const barrel = runtimeExportsOf(barrelSrc);

  /** @type {Map<string, string[]>} name -> modules that export it via a star */
  const byName = new Map();
  const visited = new Set();

  /** @param {string} file */
  async function visit(file) {
    if (visited.has(file)) return;
    visited.add(file);
    const { names, starTargets } = runtimeExportsOf(await readFile(file, 'utf8'));
    for (const name of names) {
      const list = byName.get(name) ?? [];
      list.push(relative(ROOT, file).replaceAll('\\', '/'));
      byName.set(name, list);
    }
    for (const spec of starTargets) {
      const target = resolveSpecifier(file, spec);
      if (target) await visit(target);
    }
  }

  for (const spec of barrel.starTargets) {
    const target = resolveSpecifier(barrelPath, spec);
    if (!target) continue;
    await visit(target);
  }

  const collisions = [...byName.entries()]
    .filter(([, files]) => new Set(files).size > 1)
    .map(([name, files]) => ({ name, files: [...new Set(files)].sort() }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const explicitValueReExports = [...barrel.names].filter((n) => byName.has(n)).sort();

  return { collisions, explicitValueReExports, starTargets: barrel.starTargets.length, scanned: byName.size };
}

export async function checkBarrels(barrels = DEFAULT_BARRELS) {
  /** @type {string[]} */
  const failures = [];
  for (const barrel of barrels) {
    const rel = relative(ROOT, barrel).replaceAll('\\', '/');
    if (!existsSync(barrel)) {
      failures.push(`${rel}: barrel does not exist`);
      continue;
    }
    const { collisions, explicitValueReExports, starTargets, scanned } = await auditBarrel(barrel);
    // A checker that stops seeing its own input reports a clean result over nothing. This
    // one did exactly that in its first version, so the emptiness is an error, not a pass.
    if (starTargets === 0 || scanned === 0) {
      failures.push(
        `${rel}: found ${starTargets} \`export *\` targets and ${scanned} runtime exports.\n` +
          `    A barrel with nothing in it means this checker stopped seeing its input, not\n` +
          `    that the tree is clean. Refusing to report a pass over an empty set.`,
      );
      continue;
    }
    for (const { name, files } of collisions) {
      failures.push(
        `${rel}: "${name}" is a runtime export of ${files.length} star-exported modules — ${files.join(' and ')}.\n` +
          `    Next's barrel optimizer discards the WHOLE barrel on this, so every named import\n` +
          `    from the package resolves to undefined in client components (ADR-035). tsc and\n` +
          `    next build both stay green. Delete one declaration; do not re-export a winner.`,
      );
    }
    for (const name of explicitValueReExports) {
      failures.push(
        `${rel}: explicitly re-exports the value "${name}", which is also reachable through a star.\n` +
          `    That silences TS2308 and does NOT fix the bundler — it is the exact workaround\n` +
          `    ADR-035 was written about. Only \`export type { … }\` is safe here.`,
      );
    }
  }
  return failures;
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const args = process.argv.slice(2).map((a) => resolve(a));
  const failures = await checkBarrels(args.length ? args : DEFAULT_BARRELS);
  if (failures.length === 0) {
    for (const barrel of args.length ? args : DEFAULT_BARRELS) {
      const { starTargets, scanned } = await auditBarrel(barrel);
      console.log(
        `Barrel exports  ${relative(ROOT, barrel).replaceAll('\\', '/')}\n` +
          `  ${starTargets} \`export *\` modules · ${scanned} runtime names · 0 collisions`,
      );
    }
    process.exit(0);
  }
  console.error('Barrel exports — FAIL\n');
  for (const f of failures) console.error(`  ${f}\n`);
  process.exit(1);
}
