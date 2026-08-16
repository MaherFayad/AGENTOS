/**
 * §2.3 item 9 `THE LADDER` and §2.6.5 `FROM MANUAL TO AUTONOMOUS` — one component.
 *
 * Three rows, small-caps labels on the inline-start edge: HUMAN-LED / HUMAN-ASSISTED /
 * FULLY AUTONOMOUS, each with its 12px explanation from frontmatter `ladder.*`. The active
 * label is `--ivory` and the inactive ones `--ink-3` per §2.3.9; the explanations are
 * `--ink-2` (active `--ivory-2`) per tokens contract §9.2, which §2.3.9 does not speak to —
 * see the note in `drawer.module.css`. The chart drawer adds the `NOW` badge on the current
 * state; the map drawer does not.
 *
 * §2.3 marks the active row by **colour alone**, and the spec is the record for the pixels
 * but not for the accessibility tree. So the visual stays exactly as §2.3 describes, and the
 * same fact is carried non-visually twice: `aria-current` on the row, and the word `Now` —
 * visible as the badge in the chart flavour, sr-only in the map flavour, which has no badge.
 * Both flavours therefore announce the same word a sighted chart user reads.
 *
 * That word is `t('drawer.ladder.now')`, a key that already existed in the catalogue and
 * that this component was ignoring in favour of a hardcoded `NOW`. Wiring it costs nothing,
 * invents no new copy in `rtl-arabic-pdpl-specialist`'s file, and takes the drawer's M8
 * hardcoded-string count down rather than up. The uppercase now comes from
 * `text-transform` on `.nowBadge`, per catalogue rule 1 — Arabic has no letter case, so a
 * SHOUTED literal would have arrived there as nothing.
 *
 * This is the autonomy maturity model per agent. It is not a progress bar: a `human-led`
 * agent is not "behind", so nothing here is styled as incomplete.
 *
 * Owner: drawer-engineer
 */

import { DEFAULT_LOCALE, translate } from '@/i18n';
import type { LadderRow } from '../data/project';
import s from '../drawer.module.css';

export function Ladder({ rows, nowBadge = false }: { rows: LadderRow[]; nowBadge?: boolean }) {
  const now = translate(DEFAULT_LOCALE, 'drawer.ladder.now');

  return (
    <div className={s.ladder}>
      {rows.map((row) => (
        <div
          className={s.ladderRow}
          key={row.tier}
          data-active={row.active ? 'true' : 'false'}
          aria-current={row.active ? 'true' : undefined}
        >
          <div className={s.ladderLabel}>
            {row.label}
            {row.active ? (
              <span className={nowBadge ? s.nowBadge : s.srOnly}>{now}</span>
            ) : null}
          </div>
          <div className={s.ladderText}>{row.text}</div>
        </div>
      ))}
    </div>
  );
}
