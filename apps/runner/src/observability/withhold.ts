/**
 * Withheld text — the one redaction mechanism that does not depend on a key (Part VII.4,
 * `contracts/thread-model.md` §7.1–§7.2, §9.3).
 *
 * Owner: `observability-engineer`. Unlike `redaction-rules.ts`, this file holds no rules —
 * it holds a **register of literal strings this run is forbidden to emit**, and a scrubber
 * that finds them in any string, at any depth, under any key or under none.
 *
 * ## The gap this closes, and precisely how far
 *
 * `message-body-never-traced.test.ts` (owner `rtl-arabic-pdpl-specialist`) landed the key
 * backstop and asserted the leak it could not reach:
 *
 *     trace.tool('mailbox.peek').error(`halted: ${message.body}`);
 *
 * An error message is prose. Prose has no keys, so the key pass walks past it; and no
 * *value* rule can be written for it, because the thing to catch is a sentence a person
 * typed and a regex for that would redact every agent display name in the product. The gate
 * file's own note said this closes "when `RunTrace` stops accepting free text that came from
 * a message, which is a type change". **It is not a type change and it cannot be one** — the
 * template literal above produces a `string`, and interpolation erases provenance before any
 * signature sees it. What survives interpolation is the *characters*. So the mechanism has to
 * be a literal register, which is the same shape `redact.ts` already uses for
 * `SECRET_ENV_VARS`: catch the actual value, whatever container it arrives in.
 *
 * ## Truncation is matched on purpose
 *
 * The §9.3 ruling refuses truncation **by name** — *"forty characters of a sentence a person
 * typed is forty characters of a sentence a person typed"* — because truncation is the
 * version that gets proposed later for a good reason. A register that only matched the whole
 * string would miss `body.slice(0, 40)`, i.e. it would miss the exact case the ruling
 * anticipates. So a literal at or above `WINDOW` characters is matched by **any** window of
 * that length, and the match is then expanded as far as the characters keep agreeing.
 *
 * ## What it cannot see — asserted here rather than discovered later
 *
 * - **Text that was never registered.** This is a register, not a classifier. It knows a
 *   string is client data because something told it so; nothing here can look at a sentence
 *   and decide. See `RunTrace.withhold()` for the door, and the handoff for the one call site
 *   that still has to walk through it.
 * - **A fragment shorter than `WINDOW`.** `body.slice(0, 20)` of a long body is not matched.
 *   Under `MIN_LITERAL` a literal is not registered at all, because a register full of short
 *   common strings scrubs ordinary traces into confetti.
 * - **A paraphrase, a translation, or a summary.** Characters are the handle; a model that
 *   restates a body in its own words defeats this completely, and no string mechanism reaches
 *   that. It is why the structural rule — never hand the body to the tracer — stays primary
 *   and this stays a backstop.
 * - **A string longer than `MAX_SCAN`**, which falls back to whole-literal matching only.
 * - **A literal the register refused for capacity.** See *The bound refuses* below. Refusals
 *   are counted and reported; they are not silent, and they never take protection away from
 *   something already registered.
 *
 * ## The bound refuses; it does not forget — corrected 2026-08-18
 *
 * This register was bounded by `literals.shift()` at 32 entries. `rtl-arabic-pdpl-specialist`
 * graded that while grading ADR-036 and it was a **fail-open, not a memory limit**: the 33rd
 * registered body silently un-protected the 1st, in an ordinary 33-message thread, on the one
 * mechanism whose entire job is stopping a message body reaching a trace. The oldest literal
 * is also the worst one to drop — furthest from anyone's attention, most likely to name a
 * third party (tier 3, ADR-036). A bound that drops protection is not a bound; it is an
 * expiry nobody is told about, failing in the direction that leaks.
 *
 * Three properties hold now, and the third is the one that was missing:
 *
 * 1. **Protection is monotonic.** A literal that was registered stays registered for the rest
 *    of the run. Nothing evicts, nothing expires, `size()` never decreases.
 * 2. **The budget is characters, not entries.** Characters are the resource; a count was
 *    always a bad proxy for it, and `32 × 100 KB` is the case a count cannot see.
 *    `MAX_LITERALS` survives as a second ceiling on *scrub cost*, not on memory.
 * 3. **Exhaustion refuses the newest literal and says so.** `add()` returns `false`,
 *    `refused()` counts it, and `instrument.ts` puts that count on the run's root span as
 *    `langfuse.trace.metadata.withheld_refused`.
 *
 * **The residual, stated rather than implied.** A full register still cannot withhold the
 * literal it refused, and neither bound is unreachable by construction — `ops.message.body`
 * has no length CHECK (`0008_threads.sql` §4) and `readMailbox` has no `LIMIT`, so no upstream
 * constraint caps what one drain can register. What changed is the direction and the volume of
 * the failure: it now costs the **newest** body, whose call site is still on the stack and
 * which is therefore the one a caller can act on, and it arrives as a `false` and a number on
 * the trace instead of as nothing at all.
 */

/** Shortest literal worth registering. Below this the register would scrub ordinary prose. */
export const MIN_LITERAL = 8;

/**
 * Window for partial matching. 32 characters of a sentence a human typed is still that
 * sentence; it is also long enough that an ordinary English or Arabic run of 32 characters
 * colliding with an unrelated body is not a case anyone will meet.
 */
export const WINDOW = 32;

/**
 * The register's memory budget, in characters, for one run. Roughly 1 MiB of UTF-16 — about
 * five hundred ordinary message bodies, or one pathological one.
 *
 * A budget rather than a count because characters are what actually grows. Exceeded, `add()`
 * **refuses the new literal** and counts the refusal; it never evicts an old one.
 */
export const MAX_WITHHELD_CHARS = 1_048_576;

/**
 * A second ceiling, on **scrub cost** rather than on memory: `scrub()` walks every literal for
 * every string the run emits, so the character budget alone would permit ~131k eight-character
 * entries and a redactor slow enough that someone turns it off. Reached, `add()` refuses in
 * exactly the same way. 512 is fifteen times the 33-message thread that found the old bound.
 */
export const MAX_LITERALS = 512;

/** Above this length a string is matched whole rather than scanned window-by-window. */
export const MAX_SCAN = 64_000;

/** Placeholder written in place of withheld text. Distinct from every key-rule label. */
export const WITHHELD_LABEL = 'withheld';

export type Withheld = {
  /**
   * Register a literal.
   *
   * **Returns whether this run can now withhold that text**, which is the only question a
   * caller has. `true` also when it was already registered — protection holds either way.
   * `false` in three cases, and they are not the same failure:
   *
   * - a non-string, or a string under `MIN_LITERAL` — the stated floor, by design;
   * - the character budget or the literal ceiling is exhausted — counted by `refused()`.
   *
   * A caller holding a body that came back `false` is holding text this run cannot scrub out
   * of its own error strings. That is now knowable at the call site; it used to be knowable
   * nowhere.
   */
  add(text: unknown): boolean;
  /** Replace every registered literal — whole or in part — in one string. */
  scrub(input: string): { out: string; count: number };
  /** How many literals are registered. Monotonic: this never decreases. */
  size(): number;
  /**
   * How many literals this run was told about and could not accept **for capacity**. Nonzero
   * means the run holds client text it cannot withhold; it is reported on the root span rather
   * than left for someone to notice. Floor rejections are not counted here — they are a
   * design limit, not an exhaustion.
   */
  refused(): number;
};

const placeholder = `[REDACTED:${WITHHELD_LABEL}]`;

/**
 * Scrub one literal out of one input.
 *
 * Scans left to right. At each position it asks whether the next `WINDOW` characters occur
 * anywhere in the literal; when they do, the match is extended forward for as long as the
 * two strings agree, and the whole extended run is replaced. Extending forward only is
 * deliberate and sufficient: the leftmost position whose window matches is already the
 * leftmost position a window *can* match, so anything to its left is at most `WINDOW - 1`
 * characters of overlap — which is the stated blind spot, not a second one.
 *
 * The prefix survives, which is the point: `halted: [REDACTED:withheld]` still tells an
 * operator that a halt happened and that a body was removed. Replacing the whole string
 * would make the trace say nothing, and a redactor that destroys the operational signal is
 * one people route around.
 */
function scrubLiteral(input: string, literal: string): { out: string; count: number } {
  let count = 0;

  if (literal.length < WINDOW || input.length > MAX_SCAN) {
    if (!input.includes(literal)) return { out: input, count: 0 };
    const parts = input.split(literal);
    return { out: parts.join(placeholder), count: parts.length - 1 };
  }

  let out = '';
  let i = 0;
  while (i < input.length) {
    if (i + WINDOW <= input.length) {
      const at = literal.indexOf(input.slice(i, i + WINDOW));
      if (at !== -1) {
        let len = WINDOW;
        while (
          i + len < input.length &&
          at + len < literal.length &&
          input[i + len] === literal[at + len]
        ) {
          len += 1;
        }
        out += placeholder;
        i += len;
        count += 1;
        continue;
      }
    }
    out += input[i];
    i += 1;
  }

  return { out, count };
}

export function createWithheld(): Withheld {
  // Append-only. Nothing is ever removed from this array — that is the fix, not an oversight.
  // Longest-first at scrub time so a literal containing another is consumed whole rather than
  // leaving its tail behind — the same ordering `refreshEnvSecrets` uses, for the same reason.
  const literals: string[] = [];
  let chars = 0;
  let refused = 0;

  return {
    add(text: unknown): boolean {
      if (typeof text !== 'string') return false;
      if (text.length < MIN_LITERAL) return false;
      if (literals.includes(text)) return true;
      if (literals.length >= MAX_LITERALS || chars + text.length > MAX_WITHHELD_CHARS) {
        // Refuse the newest. Evicting the oldest here is what made this a fail-open: it
        // spent an already-held protection to buy one, and told nobody.
        refused += 1;
        return false;
      }
      literals.push(text);
      chars += text.length;
      return true;
    },

    scrub(input: string): { out: string; count: number } {
      if (literals.length === 0) return { out: input, count: 0 };
      let out = input;
      let count = 0;
      for (const literal of [...literals].sort((a, b) => b.length - a.length)) {
        const result = scrubLiteral(out, literal);
        out = result.out;
        count += result.count;
      }
      return { out, count };
    },

    size: () => literals.length,
    refused: () => refused,
  };
}

/**
 * A register that holds nothing and matches nothing. Used by `redact()` when no run context
 * was supplied — a bare `redact(value)` behaves exactly as it did before this file existed.
 */
export const NO_WITHHELD: Withheld = {
  // `false`, because nothing is protected here and `add()`'s contract is "can this run
  // withhold that text". A `true` would be the same lie in a smaller costume.
  add: () => false,
  scrub: (input) => ({ out: input, count: 0 }),
  size: () => 0,
  refused: () => 0,
};
