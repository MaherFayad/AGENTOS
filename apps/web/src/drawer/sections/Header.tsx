'use client';

/**
 * §2.3 items 1–3, shared with §2.6.5 items 1–2.
 *
 * 1. Eyebrow: the autonomy state (`FULLY AUTONOMOUS`) in copper caps + close ✕.
 * 2. Title 24px/700 ivory + breadcrumb 12px --ink-2 (`Sales · Enrichment`).
 * 3. Description 13px --ivory-2.
 *
 * The chart drawer passes `eyebrow` its own value (§2.6.5 shows `COMPANIES`, the cluster,
 * rather than the tier) — same component, different frontmatter field.
 *
 * Owner: drawer-engineer
 */

import { Eyebrow } from '../primitives';
import s from '../drawer.module.css';

export function DrawerHeader({
  eyebrow,
  title,
  breadcrumb,
  description,
  titleId,
  onClose,
  closeLabel = 'Close',
}: {
  eyebrow: string;
  title: string;
  breadcrumb?: string | null;
  description?: string | null;
  titleId: string;
  onClose: () => void;
  closeLabel?: string;
}) {
  return (
    <header>
      <div className={s.eyebrowRow}>
        {/* `alive` is the primitive's name for copper (§1.3): it means "this label sits
            next to something that runs". The autonomy state is exactly that claim. */}
        <Eyebrow tone="alive">{eyebrow}</Eyebrow>
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
