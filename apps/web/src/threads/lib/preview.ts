/* =============================================================================
 * threads/lib/preview.ts — what the composer may say about a line before it is sent
 *
 * `Plan §12`, quoted because the paraphrase loses the reason:
 *
 *   "`#sales` and `@@sales` must be different characters and must *look*
 *    different, because one costs one run and the other costs six. A UI that
 *    makes broadcast easy to trigger accidentally will cost real money on the
 *    first day."
 *
 * This module is the whole of the composer's judgement, kept pure so it can be
 * falsified without a DOM. The component below it does not decide anything.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * THE ONE RULE THAT DECIDES EVERY CASE
 *
 *   The preview costs the address **as typed**, never the address as it will
 *   resolve.
 *
 * A *complete* address has a knowable run count from `addressCost()`:
 * `@sales/account-enrichment` is one run, `#sales` is at least one, `@@sales` is
 * one per member, a bare line is at least one. An *incomplete* one —
 * `@account-enrichment`, with no department — does not, because the department
 * that would answer it has not been chosen: thread-model §3.2 has the parser
 * return `department: null` rather than pick, since "picking the first match runs
 * an agent the human did not mean". A count for a recipient nobody has chosen is a
 * count for nothing.
 *
 * Whether the recipient *exists* is a different question with a different owner.
 * Resolution is the server's (§3.3), it needs the cascade's roster, and it answers
 * `address_unresolved` / `address_ambiguous`. Those arrive as refusals on POST and
 * are printed verbatim. They are deliberately **not** modelled as a cost here: a
 * cost of zero for an address that does not exist is a number, and "there is no
 * such agent" is a sentence.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * THERE IS NO MONEY IN THIS FILE AND NO FIELD THAT COULD HOLD ONE
 *
 * `Plan §23.8` asks for `@@sales · 4 runs · ~$0.40`. The `4` is real. **The
 * `$0.40` has no source** — zero runs have ever completed, so there is nothing to
 * average — and a cost preview is precisely the surface where a plausible number
 * gets believed (BOARD rule 9). `TurnCost.estimatedUsd` is typed `null` by its
 * owner so that writing a figure stops the file compiling, and `ComposerPreview`
 * adds no field of its own that a figure could hide in.
 *
 * NODE-LOADABLE LEAF: no React, no DOM, `import type` where it can be.
 * ========================================================================== */

import {
  addressCost,
  parseThreadAddress,
  type AddressRefusal,
  type ThreadAddress,
  type TurnCost,
} from '@agnetos/contracts';
import type { DepartmentRoster } from './roster';

export interface ComposerPreview {
  /** The line, trimmed of its leading space, exactly as the parser saw it. */
  line: string;
  /** `null` when the line was refused — see `refusal`. */
  address: ThreadAddress | null;
  /** Parse-time refusal, with the token and the sentence the parser wrote. */
  refusal: AddressRefusal | null;
  /** What is left after the address: the message itself. */
  body: string;
  /**
   * What this turn costs.
   *
   * `null` — nothing to cost yet (empty line, or a refused address).
   * `'unresolved'` — an address whose run count is genuinely not knowable here.
   *   `AddressBadge` renders this with **no numeral at all**, which is the point:
   *   the absence of a figure is the signal, and it is visibly different from a
   *   measured zero.
   * `TurnCost` — a real count, with `runsAreExact` saying whether it is a lower
   *   bound. It is a lower bound for `#` and for a bare line, because the lead (or
   *   the Chief of Staff) answers **or delegates**, and a delegation is a second
   *   run.
   */
  cost: TurnCost | 'unresolved' | null;
  /**
   * `true` only for `@@`. Sending this line must go through an explicit confirm
   * that **names the count** — BOARD, `Plan §23.11` rule 7. Not a tooltip, not a
   * hover: a thumb has no hover and a tooltip is not a decision.
   */
  needsFanOutConfirm: boolean;
  /**
   * The department this line addresses, when it addresses one, **and the project's
   * map does not have it**. A hint, never a block: the server resolves, and this
   * is the same index the MAP draws, so it can be stale or unavailable. `null`
   * when there is no department, when the department is known, or when nothing has
   * been counted at all — an empty roster is not evidence of absence.
   */
  unknownDepartment: string | null;
}

const EMPTY: ComposerPreview = {
  line: '',
  address: null,
  refusal: null,
  body: '',
  cost: null,
  needsFanOutConfirm: false,
  unknownDepartment: null,
};

/**
 * @param roster `rosterFrom(...)`. An **empty** roster means nothing was counted,
 *   so every fan-out costs `'unresolved'` and no department is reported missing.
 */
export function previewLine(input: string, roster: DepartmentRoster): ComposerPreview {
  const line = input.trim();
  if (line.length === 0) return EMPTY;

  const parsed = parseThreadAddress(line);
  if (!parsed.ok) {
    return { ...EMPTY, line, refusal: parsed.refusal };
  }

  const address = parsed.address;
  const base = { ...EMPTY, line, address, body: parsed.body };

  switch (address.form) {
    case 'direct':
      return address.department === null
        ? // `@account-enrichment` — legal to type, not yet an address.
          { ...base, cost: 'unresolved' }
        : {
            ...base,
            cost: addressCost(
              { form: 'direct', department: address.department, slug: address.slug },
              // Read only for fan-out. `0` here is the contract's own instruction
              // for every other form, not a stand-in for a count.
              0,
            ),
          };

    case 'dispatch':
      return {
        ...base,
        // Roster-independent: dispatch costs the lead's run whatever the
        // department's size, and at least one more if the lead delegates.
        cost: addressCost({ form: 'dispatch', department: address.department }, 0),
        unknownDepartment: missingDepartment(address.department, roster),
      };

    case 'fan-out': {
      const members = roster.get(address.department);
      return {
        ...base,
        // The only branch where the number is a measurement. No count ⇒ no number.
        cost:
          members === undefined
            ? 'unresolved'
            : addressCost({ form: 'fan-out', department: address.department }, members),
        needsFanOutConfirm: true,
        unknownDepartment: missingDepartment(address.department, roster),
      };
    }

    case 'default':
      return { ...base, cost: addressCost({ form: 'default' }, 0) };
  }
}

/**
 * A department name the index does not carry — or `null` when we are in no
 * position to say. An empty roster is "nobody counted", and reporting every
 * department as missing while the graph is down would be an absence rendered as a
 * finding.
 */
function missingDepartment(department: string, roster: DepartmentRoster): string | null {
  if (roster.size === 0) return null;
  return roster.has(department) ? null : department;
}
