import type { ReactNode } from 'react';
import s from '../drawer.module.css';

/**
 * A labelled section of either drawer.
 *
 * The collapse rule lives here so it cannot be forgotten in one of thirteen call sites:
 * `when={false}` renders nothing at all — no header, no "N/A", no empty box (§2.3).
 *
 * Owner: drawer-engineer
 */
export function Section({
  label,
  when = true,
  children,
  id,
}: {
  label: string;
  when?: boolean;
  children: ReactNode;
  id?: string;
}) {
  if (!when) return null;
  return (
    <section className={s.section} aria-labelledby={id}>
      <h3 className={s.sectionLabel} id={id}>
        {label}
      </h3>
      {children}
    </section>
  );
}
