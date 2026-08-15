/**
 * The read-only prose bits, all four of them straight out of frontmatter.
 *
 *   §2.3 item 6  WIRED INTO      — plain text list (`Exa · Firecrawl`)
 *   §2.3 item 8  WHAT IT REPLACES — quote box on --card
 *   §2.6.5       REPLACES         — the same box, cost-flavoured
 *   §2.3 item 10 THE HUMAN        — closing paragraph
 *
 * Owner: drawer-engineer
 */

import s from '../drawer.module.css';

/** WIRED INTO. The separator is the product's, the names are the frontmatter's. */
export function WiredIntoList({ tools }: { tools: string[] }) {
  return <p className={s.plainList}>{tools.join(' · ')}</p>;
}

/**
 * WHAT IT REPLACES / REPLACES. `cost` is the §2.6.5 flavour, where the sentence carries a
 * money figure — the emphasis is the box, not an invented number.
 */
export function QuoteBox({ text, cost = false }: { text: string; cost?: boolean }) {
  return <blockquote className={cost ? `${s.quote} ${s.quoteCost}` : s.quote}>{text}</blockquote>;
}

/** THE HUMAN, and §2.6.5's HOW TO RUN IT / WHAT IT DOES. */
export function Paragraph({ text }: { text: string }) {
  return <p className={s.paragraph}>{text}</p>;
}
