'use client';

/**
 * §2.3 items 1–3, shared with §2.6.5 items 1–2, plus `Plan §23.6`'s provenance.
 *
 * 1. Eyebrow: the autonomy state (`FULLY AUTONOMOUS`) in copper caps + provenance + close ✕.
 * 2. Title 24px/700 ivory + breadcrumb 12px --ink-2 (`Sales · Enrichment`).
 * 3. Description 13px --ivory-2.
 *
 * The chart drawer passes `eyebrow` its own value (§2.6.5 shows `COMPANIES`, the cluster,
 * rather than the tier) — same component, different frontmatter field. Provenance is
 * identical in both, which is the point: two drawers, one component set, one answer.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY PROVENANCE SITS IN THE EYEBROW ROW AND NOT NEXT TO THE TITLE
 *
 * Placement is `design-system-guardian`'s, quoted rather than chosen:
 * *"drawer header, beside the eyebrow (`Plan §23.6`) — `size="md"`."* The row already reads
 * as one line of context about the thing below it, and the two labels answer adjacent
 * questions — *how autonomous is it* and *whose is it*. They must not merge visually: the
 * eyebrow is copper because the autonomy state is a claim about a thing that runs (§1.3),
 * and provenance is grey because chrome spends no colour. A reader who can see the
 * difference in colour can also see which question is which.
 *
 * Owner: drawer-engineer · Primitive owner: design-system-guardian
 */

import { useT } from '@/i18n';
import { ProvenanceBadge } from '@/components/primitives';
import type { DrawerProvenance } from '../data/provenance';
import { Eyebrow } from '../primitives';
import s from '../drawer.module.css';

export function DrawerHeader({
  eyebrow,
  title,
  breadcrumb,
  description,
  provenance,
  titleId,
  onClose,
  closeLabel = 'Close',
}: {
  eyebrow: string;
  title: string;
  breadcrumb?: string | null;
  description?: string | null;
  /**
   * Required, with no default, for the same reason the primitive has none: a header that
   * silently omits provenance and a header that says `global` are two different claims, and
   * a default would let a call site spend the second while meaning the first.
   */
  provenance: DrawerProvenance;
  titleId: string;
  onClose: () => void;
  closeLabel?: string;
}) {
  return (
    <header>
      <div className={s.eyebrowRow}>
        <div className={s.eyebrowGroup}>
          {/* `alive` is the primitive's name for copper (§1.3): it means "this label sits
              next to something that runs". The autonomy state is exactly that claim. */}
          <Eyebrow tone="alive">{eyebrow}</Eyebrow>
          <HeaderProvenance provenance={provenance} />
        </div>
        <button type="button" className={s.close} onClick={onClose} aria-label={closeLabel} title={closeLabel}>
          ✕
        </button>
      </div>
      <h2 className={s.title} id={titleId}>
        {title}
      </h2>
      {breadcrumb ? <p className={s.breadcrumb}>{breadcrumb}</p> : null}
      {description ? <p className={s.description}>{description}</p> : null}
    </header>
  );
}

/**
 * Known → the primitive. Unknown → a sentence that says so.
 *
 * **The unknown branch is not a sixth badge and must never become one.** It draws no mark,
 * because a mark is the primitive's vocabulary and every one of its five silhouettes is a
 * claim about a layer. This is the absence of a claim, so it is set in the badge's own
 * typography — 10px caps, `--track-1`, the same rhythm — one step quieter at `--ink-2`,
 * which is the token every other honest empty state in this drawer already uses (`.empty`,
 * `.sectionNote`) and is explicitly **not** the disabled `--ink-3`: an empty state is
 * content, and `drawer-contrast.test.ts` holds that line.
 *
 * The visible label is short enough to sit beside the eyebrow; the reason it is unknown is
 * a full sentence in the accessibility tree, where a long one costs nothing. Both come from
 * the catalogue — `check-rtl.mjs` would fail either as a typed-in string, correctly, since
 * a string in a component is a string nobody can translate.
 */
function HeaderProvenance({ provenance }: { provenance: DrawerProvenance }) {
  const t = useT();

  if (provenance.kind === 'known') {
    return <ProvenanceBadge state={provenance.state} />;
  }

  return (
    <span className={s.provenanceUnknown}>
      {/* aria-hidden on the abbreviation, exactly as the badge does it: the sentence below
          says it properly, and announcing both reads it twice. */}
      <span aria-hidden>{t('drawer.provenance.unknown')}</span>
      <span className={s.srOnly}>{t('a11y.provenance.unknown')}</span>
    </span>
  );
}
