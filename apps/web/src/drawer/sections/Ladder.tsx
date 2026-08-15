/**
 * §2.3 item 9 `THE LADDER` and §2.6.5 `FROM MANUAL TO AUTONOMOUS` — one component.
 *
 * Three rows, small-caps labels on the inline-start edge: HUMAN-LED / HUMAN-ASSISTED /
 * FULLY AUTONOMOUS. The active row is ivory, the others --ink-3, each with its 12px
 * explanation from frontmatter `ladder.*`. The chart drawer adds the `NOW` badge on the
 * current state; the map drawer does not (§2.3 marks the active row by colour alone).
 *
 * This is the autonomy maturity model per agent. It is not a progress bar: a `human-led`
 * agent is not "behind", so nothing here is styled as incomplete.
 *
 * Owner: drawer-engineer
 */

import type { LadderRow } from '../data/project';
import s from '../drawer.module.css';

export function Ladder({ rows, nowBadge = false }: { rows: LadderRow[]; nowBadge?: boolean }) {
  return (
    <div className={s.ladder}>
      {rows.map((row) => (
        <div className={s.ladderRow} key={row.tier} data-active={row.active ? 'true' : 'false'}>
          <div className={s.ladderLabel}>
            {row.label}
            {nowBadge && row.active ? <span className={s.nowBadge}>NOW</span> : null}
          </div>
          <div className={s.ladderText}>{row.text}</div>
        </div>
      ))}
    </div>
  );
}
