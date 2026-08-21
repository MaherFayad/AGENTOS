/**
 * The eight canonical departments — ADR-001 (the seven, §2.1's radial branches and
 * §2.6.1's CHART tab bar), amended by ADR-041 (`product`, appended at index 7).
 *
 * This file is the ONLY place a department slug, label, angle or neighbour may be
 * written down. The MAP's forceRadial angles, the CHART tab order, the frontmatter
 * validator, the panel `department` field and the rail labels all read from here.
 * ADR-001: "packages/contracts/departments.ts exports the ordered array; nothing else
 * may hardcode a department name or angle."
 */

/**
 * The slugs, in canonical order — the CHART tab order and the MAP branch angle order.
 * **This is the primary declaration**; everything else in this file derives from it.
 *
 * `product` is **appended**, not inserted (ADR-041). Insertion would have renumbered every
 * department after it, and `index` is what the layout engine's stability rule keys a
 * branch's ray to; appending leaves all seven of ADR-001's indices exactly where they were.
 * The *angles* move regardless — `360/8` is not `360/7` — which is why ADR-041 also records
 * that stored positions are sticky and only the new branch is seeded fresh.
 *
 * `as const` is load-bearing rather than stylistic: `z.enum()` needs a literal tuple, and
 * a `readonly DepartmentSlug[]` does not satisfy it. Deriving this from a mapped array
 * widens it back to an array and breaks `frontmatter.ts` at the type level (ADR-035).
 */
export const DEPARTMENT_SLUGS = [
  'sales',
  'deals',
  'marketing',
  'operations',
  'intelligence',
  'customer',
  'back-office',
  'product',
] as const;

export type DepartmentSlug = (typeof DEPARTMENT_SLUGS)[number];

/**
 * Display labels. `back-office` is the slug and path segment; `Back Office` is the label.
 *
 * Typed `Record<DepartmentSlug, string>` and living beside the slugs on purpose: the two
 * lists cannot drift, because omitting one is a compile error rather than a missing label
 * discovered on screen.
 */
export const DEPARTMENT_LABELS: Record<DepartmentSlug, string> = {
  sales: 'Sales',
  deals: 'Deals',
  marketing: 'Marketing',
  operations: 'Operations',
  intelligence: 'Intelligence',
  customer: 'Customer',
  'back-office': 'Back Office',
  product: 'Product',
};

const ORDERED = DEPARTMENT_SLUGS.map((slug) => [slug, DEPARTMENT_LABELS[slug]] as const);

/**
 * One row of the department table.
 *
 * Named `DepartmentInfo`, not `Department`, on purpose: `frontmatter.ts` uses
 * `Department` for the *slug union* (the value that appears in a SKILL.md field), and one
 * name meaning two things inside one package is how a cast silently lies. Here:
 *   `Department`      — the slug, e.g. `'sales'`            (frontmatter.ts)
 *   `DepartmentSlug`  — the same union, from this file
 *   `DepartmentInfo`  — this record: slug + label + angle + neighbours
 */
export interface DepartmentInfo {
  /** Path segment and frontmatter value. `agents/<slug>/<agent>/SKILL.md`. */
  readonly slug: DepartmentSlug;
  /** Human label. Rendered in the CHART tab bar and the MAP rail. */
  readonly label: string;
  /** Position in the canonical order. 0 = sales. */
  readonly index: number;
  /**
   * Radial branch angle in degrees, `-90 + index * 360 / COUNT`, so `sales` sits at twelve
   * o'clock and the branches run clockwise (ADR-001's table, recomputed at eight by ADR-041).
   * Kept unrounded here — rounding is a display concern.
   */
  readonly angleDeg: number;
  /** Same angle in radians, for d3 `forceRadial` / trig without a conversion at each site. */
  readonly angleRad: number;
  /**
   * Rail neighbours as `[previous, next]`, cyclic over the canonical order.
   * §2.2's department rail steps through these; the last department wraps to `sales`.
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
  if (!found) throw new Error(`Unknown department "${slug}" (ADR-001 + ADR-041 fix the enum at eight).`);
  return found;
}

/** Non-throwing lookup for parser paths that must report rather than crash. */
export function findDepartment(slug: string): DepartmentInfo | undefined {
  return BY_SLUG.get(slug);
}

/** Display label for a slug. `back-office` -> `Back Office`. */
export function departmentLabel(slug: DepartmentSlug): string {
  return getDepartment(slug).label;
}
