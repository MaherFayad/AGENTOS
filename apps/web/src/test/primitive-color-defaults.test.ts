/**
 * REQ-A11Y-DEFAULT-TONE — **a default prop is a token spent at a call site that never
 * mentions it.**
 *
 * The sentence above is `fidelity-qa-reviewer`'s, written after `dashboards-engineer` found
 * two `<RailLabel>` call sites rendering required reading in `--ink-3` while containing no
 * string any grep for `ink-3` could match. The token owner's own fourteen-site enumeration
 * missed them, the review missed them, and `check-tokens.mjs` cannot see them — because all
 * three instruments are text searches over call sites, and the colour was in the primitive.
 *
 * `dashboards-contrast.test.ts:220` closed that hole **for one directory and one component**.
 * Its own comment calls it *"the one worth stealing back"*, and the reviewer asked for it to be
 * generalised, on the grounds that a one-directory guard against a repo-wide primitive default
 * holds only until someone adds a rail somewhere else. This file is that generalisation, and
 * the generalisation runs in two directions, both of which matter:
 *
 *   1. **Which primitives** — derived from the source of every primitive, not from a list
 *      someone maintains. A new component whose default resolves to a sub-AA text token is
 *      caught the day it lands, whether or not anyone remembers this file exists.
 *   2. **Which call sites** — every `.tsx` under `src/`, not one feature directory.
 *
 * What it deliberately does NOT do: judge whether a given string is required reading. No
 * static rule can (tokens contract §9.6 says so plainly). It enforces the weaker, mechanical
 * rule that survives automation — **if a primitive's default is below the AA floor, every call
 * site must say out loud which tone it wanted** — and leaves the judgement to §9.2's
 * delete-the-text test in review. A call site that genuinely wants faint writes `tone="faint"`
 * and this file is satisfied; what it forbids is spending the token by silence.
 *
 * **Adopted 2026-08-16 by `design-system-guardian` and written into the contract (§9.6a).**
 * Offered by `map-galaxy-engineer` (§2.1–2.2), who wrote it because the finding landed on
 * their file. It stays in `src/test/` — it is repo-wide by construction and moving it into
 * `components/primitives/` would imply it guards only that directory, which is the exact
 * narrowness it was written to remove. Ownership is the contract's, not the folder's.
 *
 * One thing changed on adoption, and it is worth stating because it is the same class of
 * defect as the one the file exists to catch. The deriver's self-check originally asserted
 * `RailLabel.tone` was flagged — i.e. it proved the deriver worked **by requiring the known
 * defect to still be present**. So the guard would have gone red on the fix it asked for, in
 * the one test whose message says the fixer should not have broken it. It now proves the
 * deriver works by *mutating* the real primitive back to its old default and requiring the
 * flag to appear — same coverage of the parsing shape, no dependency on anything being wrong.
 *
 * Contract: comms/contracts/design-tokens.md §9.1 (the measurements), §9.2 (the rule),
 * §9.6 (why the static checker cannot do this), §9.6a (this file), §9.7 (the RailLabel
 * ruling and which spec-named `--ink-3` values §9 supersedes).
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC = resolve(process.cwd(), 'src');
const PRIMITIVES = join(SRC, 'components', 'primitives');

/**
 * The text utilities that cannot carry meaning, straight from contract §9.1's measured table:
 * `--ink-3` is 3.18–3.83 dark and 2.77–3.29 light and **fails AA on every surface in both
 * themes**. It is the only text token that does. This product ships no text at or above
 * 18.66px, so the large-text 3:1 exemption never applies (§9.1).
 *
 * `--ink-2` is deliberately absent: it is the floor, and a default that lands *on* the floor
 * is legal (§9.2). §9.5's light `--bg-2`/`--card-2` gap is a surface question, not a default-
 * prop question, and belongs to ADR-011.
 */
const SUB_AA_TEXT = ['text-ink-3'];

/**
 * Defaults that are sub-AA today and are known. **The list is empty, and empty is the
 * finding.**
 *
 * It had exactly one entry — `RailLabel.tone` — from the moment this file was written until
 * the owner ruled on it hours later. The ruling flipped the default to `muted`, so every
 * primitive in the repo now defaults at or above the AA floor: `Chip` → `text-ivory-2`,
 * `KpiNumeral` and `Pill` → `text-ivory`, `Eyebrow` and `RailLabel` → `text-ink-2`,
 * `Card`/`GlassPanel`/`SegmentedControl` spend no text colour at all.
 *
 * Keep the mechanism rather than deleting it with the entry. The point was never the one
 * component: it is that a colour spent by a default prop is invisible to every text search
 * this repo runs, so the next one has to be caught by shape rather than by memory. An empty
 * allow-list is the strongest state this file can be in — anything that appears here later
 * must arrive with a reason someone wrote down.
 *
 * The assertion is a **subset** check, not an equality check, on purpose: a fix should never
 * break the guard that asked for it. That principle is why this list can go empty without a
 * single edit to the assertions below.
 */
const KNOWN_SUB_AA_DEFAULTS: Record<string, string> = {};

function tsxFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === 'node_modules' || entry === '__snapshots__') continue;
      out.push(...tsxFiles(full));
      continue;
    }
    if (entry.endsWith('.tsx') && !entry.endsWith('.test.tsx')) out.push(full);
  }
  return out.sort();
}

const rel = (f: string) => f.slice(SRC.length + 1).replace(/\\/g, '/');
const stripComments = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

/**
 * Read a primitive and return the props whose *default value* selects a sub-AA text class.
 *
 * Every primitive in this repo follows the same two-part shape, which is what makes this
 * derivable rather than hand-listed:
 *   - a frozen lookup — `const TONE = { faint: 'text-ink-3', muted: 'text-ink-2' } as const;`
 *   - a destructured default — `{ tone = 'faint', ... }`
 *
 * A prop is flagged when its default is a key of some lookup in the same file whose value
 * contains a sub-AA text utility. Colon binds map entries and `=` binds defaults, so the two
 * regexes cannot confuse one for the other; requiring the default to *be a key of a colour
 * map* is what keeps `serif = false` and `prefix = ''` out of the results.
 */
function subAaDefaults(source: string): string[] {
  const src = stripComments(source);

  const maps: Record<string, string>[] = [];
  for (const [, body] of src.matchAll(/const\s+[A-Z][A-Z0-9_]*\s*=\s*\{([^}]*)\}\s*as const/g)) {
    const map: Record<string, string> = {};
    for (const [, key, value] of body.matchAll(/(\w+)\s*:\s*'([^']*)'/g)) map[key] = value;
    maps.push(map);
  }

  const flagged = new Set<string>();
  for (const [, prop, def] of src.matchAll(/(\w+)\s*=\s*'([^']+)'/g)) {
    for (const map of maps) {
      const classes = map[def];
      if (classes && SUB_AA_TEXT.some((t) => classes.split(/\s+/).includes(t))) flagged.add(prop);
    }
  }
  return [...flagged].sort();
}

/** `<Comp …>` and `<Comp … />`, across line breaks. `[^>]*` spans newlines; `.` would not. */
const callSites = (src: string, comp: string) =>
  src.match(new RegExp(`<${comp}\\b[^>]*>`, 'g')) ?? [];

describe('primitive defaults that spend a colour (design-tokens §9)', () => {
  const primitives = tsxFiles(PRIMITIVES).map((file) => ({
    file,
    name: file.split(/[\\/]/).pop()!.replace('.tsx', ''),
    props: subAaDefaults(readFileSync(file, 'utf8')),
  }));

  it('finds the primitives to guard by reading them, not by trusting a list', () => {
    // Guards the deriver itself. If a refactor changes the `const MAP = {…} as const` shape,
    // `subAaDefaults` silently returns nothing and every assertion below passes vacuously —
    // a green suite that checks nothing, which is worse than a red one.
    //
    // Proved by mutation rather than by inspection: put the old sub-AA default back into the
    // real RailLabel source and require the deriver to flag it, then confirm the shipped file
    // is clean. This exercises the actual parsing shape of a real primitive, and — unlike the
    // original version of this assertion — it does not require any component in the repo to
    // still be broken in order to pass.
    expect(primitives.length).toBeGreaterThan(5);
    const railLabel = primitives.find((p) => p.name === 'RailLabel');
    expect(railLabel, 'RailLabel.tsx must exist for this suite to mean anything').toBeDefined();

    const source = readFileSync(railLabel!.file, 'utf8');
    expect(source, 'RailLabel must still keep a faint tone for §9.3 to opt into').toContain(
      "faint: 'text-ink-3'",
    );
    const mutated = source.replace("tone = 'muted'", "tone = 'faint'");
    expect(mutated, 'the mutation must actually apply, or this proves nothing').not.toBe(source);
    expect(subAaDefaults(mutated)).toContain('tone');
    expect(railLabel!.props, 'and the shipped default must not be the mutated one').toEqual([]);
  });

  it('has no sub-AA default beyond the ones on record', () => {
    const found = primitives.flatMap((p) => p.props.map((prop) => `${p.name}.${prop}`)).sort();
    const unrecorded = found.filter((k) => !(k in KNOWN_SUB_AA_DEFAULTS));
    expect(
      unrecorded,
      'A new primitive default resolves to a text token that fails AA on every surface ' +
        '(§9.1). Either give it an AA-or-better default, or add it above with the reason and ' +
        'route it to design-system-guardian.',
    ).toEqual([]);
    for (const reason of Object.values(KNOWN_SUB_AA_DEFAULTS)) {
      expect(reason.length).toBeGreaterThan(80);
    }
  });

  /**
   * The call-site sweep, extracted so it can be run against a SYNTHETIC armed list. That
   * extraction is the whole point of the rewrite below — see the two tests that use it.
   */
  const sweep = (armed: { name: string; props: string[]; file: string }[]) => {
    const offenders: string[] = [];
    let tagsExamined = 0;
    for (const { name, props, file: own } of armed) {
      if (props.length === 0) continue;
      for (const file of tsxFiles(SRC)) {
        if (file === own) continue;
        const src = stripComments(readFileSync(file, 'utf8'));
        for (const tag of callSites(src, name)) {
          tagsExamined++;
          for (const prop of props) {
            if (!new RegExp(`\\b${prop}\\s*=`).test(tag)) {
              offenders.push(`${rel(file)}: <${name}> must state ${prop}=, not inherit it`);
            }
          }
        }
      }
    }
    return { offenders: offenders.sort(), tagsExamined };
  };

  /**
   * RENAMED AND SPLIT 2026-08-17 by the contract owner, on `commandcenter-orchestrator`'s
   * finding, and the rename is the substance rather than the tidying.
   *
   * The single assertion this replaces was called *"lets no call site anywhere in src/
   * inherit one of them in silence"* — a name promising an active, repo-wide guarantee —
   * while its body opened with `if (props.length === 0) continue`. With
   * `KNOWN_SUB_AA_DEFAULTS` empty and no primitive defaulting sub-AA, that loop iterated
   * over an empty armed set and passed **without examining a single tag**. Green, fast,
   * and checking nothing, under a name a reader would cite.
   *
   * §9.6a already argued the dormancy is *correct*: this is a trap, not a patrol, and
   * "fixing" it by re-adding an entry to keep it busy is the exact defect corrected one
   * paragraph above it — a guard that requires something to still be broken. So the
   * dormancy stays and the SILENCE goes. Two tests instead of one:
   *
   *   1. the trap is dormant, and says so out loud with the number it examined;
   *   2. the trap fires when armed, proved by arming it synthetically.
   *
   * That is the same shape as the deriver's own self-check: prove the mechanism by
   * mutation rather than by leaving a real defect in place to lean on.
   */
  it('is dormant today, examines nothing, and does not pretend otherwise', () => {
    const armed = primitives.filter((p) => p.props.length > 0);
    const { offenders, tagsExamined } = sweep(primitives);

    expect(offenders).toEqual([]);
    // The vacuity, asserted rather than inherited. If a sub-AA default ever lands, this
    // line goes red and the reader is sent to the test below instead of to a green tick
    // that meant nothing.
    expect(
      armed,
      'A primitive now defaults to a sub-AA text token, so this suite is no longer dormant. ' +
        'That is not a failure of this assertion — it is the trap arming. Fix the default, ' +
        'or record it in KNOWN_SUB_AA_DEFAULTS with a reason and route it to ' +
        'design-system-guardian.',
    ).toEqual([]);
    expect(
      tagsExamined,
      'With no armed prop there is nothing to examine, and that is the honest state (§9.6a). ' +
        'A nonzero count here would mean the dormancy reasoning above has gone stale.',
    ).toBe(0);
  });

  it('patrols every call site in src/ the moment a sub-AA default appears', () => {
    // The half the dormant test cannot cover: that the sweep WORKS. Armed synthetically
    // against components the repo really uses, so the walk, the tag regex and the
    // prop-stated branch are all exercised against real files — and, as with the deriver's
    // own self-check above, nothing in the repo has to be broken for it to mean anything.
    //
    // BOTH DIRECTIONS, because one is not a proof. A sweep that always fires and a sweep
    // that never fires are equally useless, and only the second one looks green.
    const chip = primitives.find((p) => p.name === 'Chip')!;
    const railLabel = primitives.find((p) => p.name === 'RailLabel')!;

    // (a) FIRES. `__armedProbe` is a prop no call site states, because it does not exist —
    // so every real `<Chip>` in the tree must be named. Deliberately a nonsense prop: a
    // reader must not be able to mistake this arming for a rule anybody has to follow.
    const fires = sweep([{ name: 'Chip', props: ['__armedProbe'], file: chip.file }]);
    expect(
      fires.tagsExamined,
      '<Chip> must still be used somewhere in src/, or this proves nothing about the walk',
    ).toBeGreaterThan(0);
    expect(
      fires.offenders.length,
      'Armed on a prop no call site can possibly state, the sweep must name every <Chip> ' +
        'in the tree. Empty here means the walk or the tag regex has stopped finding call ' +
        'sites — the silent-green failure this pair exists to prevent.',
    ).toBe(fires.tagsExamined);
    expect(fires.offenders.every((o) => o.includes('<Chip> must state __armedProbe='))).toBe(true);

    // (b) STAYS SILENT when the prop IS stated. `RailLabel.tone` is the real case §9.7
    // ruled on: the default moved to `muted` and the two sites that want a specific tone
    // say so out loud. Armed on it, the sweep must find the call sites and forgive them —
    // which is what separates a guard from a tripwire that fires on everything.
    const quiet = sweep([{ name: 'RailLabel', props: ['tone'], file: railLabel.file }]);
    expect(quiet.tagsExamined, '<RailLabel> must still be used somewhere').toBeGreaterThan(0);
    expect(
      quiet.offenders,
      'Every shipped <RailLabel> states its tone (§9.7). A name here is a real finding, ' +
        'not a failure of this test.',
    ).toEqual([]);
  });
});
