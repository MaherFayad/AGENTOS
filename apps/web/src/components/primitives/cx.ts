/**
 * cx — the entire class-name utility. Twelve lines instead of a dependency.
 *
 * Part V bans a component library; a class-merging library is the same argument
 * one size down. Falsy entries drop out, everything else joins with a space.
 */
export type ClassValue = string | number | false | null | undefined;

export function cx(...parts: ClassValue[]): string {
  let out = '';
  for (const p of parts) {
    if (!p && p !== 0) continue;
    out = out ? `${out} ${p}` : String(p);
  }
  return out;
}
