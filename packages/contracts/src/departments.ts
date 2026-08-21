/**
 * The six canonical departments — ADR-042.
 *
 * This file is the ONLY place a department slug, label, angle or neighbour may be
 * written down. The MAP's forceRadial angles, the CHART tab order, the frontmatter
 * validator, the panel `department` field and the rail labels all read from here.
 * ADR-001: "packages/contracts/departments.ts exports the ordered array; nothing else
 * may hardcode a department name or angle." That rule survives ADR-042; only the rows do.
 *
 * ## Why these six, and why the seven that are gone
 *
 * ADR-001 took §2.6.1's tab bar verbatim — Sales, Deals, Marketing, Operations,
 * Intelligence, Customer, Back Office — because copying the reference kept the fidelity
 * comparison honest. ADR-041 appended `product`. That table described a *sales agency*.
 * The owner of this instance is a product designer, and ADR-042 records the ruling that a
 * department nobody in this house will ever open is worse than a missing one: it is six
 * empty branches on the MAP, six empty CHART tabs, and four dashboards whose numbers can
 * never become real (BOARD constraint 9).
 *
 * `product` and `intelligence` survive unchanged — the same slugs, carrying the same
 * agents. `design`, `frontend`, `backend` and `ai` are new. Everything else is deleted,
 * agents and panels with it, rather than left hidden behind a flag: a slug that still
 * validates is a slug something will eventually be filed under.
 */

/**
 * The slugs, in canonical order — the CHART tab order and the MAP branch angle order.
 * **This is the primary declaration**; everything else in this file derives from it.
 *
 * The order is the shape of the work, clockwise from twelve o'clock: a problem enters at
 * `product`, is specified at `design`, built across `frontend` and `backend`, given its
 * agent surface at `ai`, and measured at `intelligence` — which feeds the next thing
 * `product` picks up. It is a loop on purpose, because §2.1 draws it as one.
 *
 * ADR-041's append-don't-insert rule does not apply here and could not: ADR-042 removes
 * rows rather than adding them, so every surviving index moves regardless and there is no
 * ordering that preserves them. Stored positions are therefore re-seeded, not kept —
 * `npm run graph:build` rewrites `agents/_registry/positions.json` in the same commit.
 *
 * `as const` is load-bearing rather than stylistic: `z.enum()` needs a literal tuple, and
 * a `readonly DepartmentSlug[]` does not satisfy it. Deriving this from a mapped array
 * widens it back to an array and breaks `frontmatter.ts` at the type level (ADR-035).
 */
export const DEPARTMENT_SLUGS = [
  'product',
  'design',
  'frontend',
  'backend',
  'ai',
  'intelligence',
] as const;

export type DepartmentSlug = (typeof DEPARTMENT_SLUGS)[number];

/**
 * Display labels.
 *
 * `ai` is the slug and path segment; `AI` is the label — the one row where the label is
 * not the slug title-cased, which is why this table exists rather than a transform.
 *
 * Typed `Record<DepartmentSlug, string>` and living beside the slugs on purpose: the two
 * lists cannot drift, because omitting one is a compile error rather than a missing label
 * discovered on screen.
 */
export const DEPARTMENT_LABELS: Record<DepartmentSlug, string> = {
  product: 'Product',
  design: 'Design',
  frontend: 'Frontend',
  backend: 'Backend',
  ai: 'AI',
  intelligence: 'Intelligence',
};

const ORDERED = DEPARTMENT_SLUGS.map((slug) => [slug, DEPARTMENT_LABELS[slug]] as const);

/**
 * One row of the department table.
 *
 * Named `DepartmentInfo`, not `Department`, on purpose: `frontmatter.ts` uses
 * `Department` for the *slug union* (the value that appears in a SKILL.md field), and one
 * name meaning two things inside one package is how a cast silently lies. Here:
 *   `Department`      — the slug, e.g. `'product'`          (frontmatter.ts)
 *   `DepartmentSlug`  — the same union, from this file
 *   `DepartmentInfo`  — this record: slug + label + angle + neighbours
 */
export interface DepartmentInfo {
  /** Path segment and frontmatter value. `agents/<slug>/<agent>/SKILL.md`. */
  readonly slug: DepartmentSlug;
  /** Human label. Rendered in the CHART tab bar and the MAP rail. */
  readonly label: string;
  /** Position in the canonical order. 0 = product. */
  readonly index: number;
  /**
   * Radial branch angle in degrees, `-90 + index * 360 / COUNT`, so `product` sits at
   * twelve o'clock and the branches run clockwise (ADR-042's table).
   * Kept unrounded here — rounding is a display concern.
   */
  readonly angleDeg: number;
  /** Same angle in radians, for d3 `forceRadial` / trig without a conversion at each site. */
  readonly angleRad: number;
  /**
   * Rail neighbours as `[previous, next]`, cyclic over the canonical order.
   * §2.2's department rail steps through these; the last department wraps to `product`.
   */
  readonly neighbours: readonly [DepartmentSlug, DepartmentSlug];
}

const COUNT = ORDERED.length;

/** The ordered department table. Iterate this; never re-declare it. */
export const DEPARTMENTS: readonly DepartmentInfo[] = ORDERED.map(([slug, label], index) => {
  const angleDeg = -90 + (index * 360) / COUNT;
  return {
    slug,
    label,
    index,
    angleDeg,
    angleRad: (angleDeg * Math.PI) / 180,
    neighbours: [
      ORDERED[(index - 1 + COUNT) % COUNT][0],
      ORDERED[(index + 1) % COUNT][0],
    ] as const,
  };
});

const BY_SLUG = new Map<string, DepartmentInfo>(DEPARTMENTS.map((d) => [d.slug, d]));

/** Type guard. An unknown department is a validation error, never a silent default. */
export function isDepartment(value: unknown): value is DepartmentSlug {
  return typeof value === 'string' && BY_SLUG.has(value);
}

/** Throws on an unknown slug — callers that have already validated should use this. */
export function getDepartment(slug: DepartmentSlug): DepartmentInfo {
  const found = BY_SLUG.get(slug);
  if (!found) throw new Error(`Unknown department "${slug}" (ADR-042 fixes the enum at six).`);
  return found;
}

/** Non-throwing lookup for parser paths that must report rather than crash. */
export function findDepartment(slug: string): DepartmentInfo | undefined {
  return BY_SLUG.get(slug);
}

/** Display label for a slug. `ai` -> `AI`. */
export function departmentLabel(slug: DepartmentSlug): string {
  return getDepartment(slug).label;
}
