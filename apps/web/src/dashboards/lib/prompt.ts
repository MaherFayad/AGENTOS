/**
 * Compose the Claude Code one-shot that rebuilds a panel (§2.5.1).
 *
 * The ghost button on the detail view copies this. The panel JSON is the source of
 * truth; the prompt tells the next session to write a file, not a component.
 *
 * Owner: dashboards-engineer · Spec §2.5.1
 */

import type { Panel } from '@agnetos/contracts';

/**
 * The vocabulary, spelled out for the model.
 *
 * It is a **mirror** of `WIDGET_TYPES` / `RESERVED_WIDGET_TYPES` rather than an import,
 * because this module is loaded by a `node --test` suite that cannot resolve the contracts
 * barrel's extensionless re-exports, and a type-only import is what keeps it loadable. So
 * the copy is pinned instead of trusted: `__tests__/widgets.test.mjs` asserts these two
 * lines against the enums themselves, and drift is red. Before ADR-028 the same list was
 * inlined in the prompt body as "exactly the seven widget types", pinned by nothing — the
 * prompt that rebuilds a panel would have kept naming a vocabulary the validator had
 * stopped accepting.
 *
 * rtl-exempt: these are `type` identifiers in a model instruction, not copy for a reader —
 * the same reason the prompt body below is exempt, and a translated `bar-list` would fail
 * validation. Same marker, same §1.4 rule; the block is kept together deliberately, since
 * an exemption ends at the next blank line.
 */
export const PROMPT_WIDGET_TYPES =
  'bar-list, source-bar-list, area-chart, cost-table, data-table, progress-table, activity-feed, thread-feed, calendar';
export const PROMPT_RESERVED_TYPES = 'board';

export function buildPromptFor(panel: Panel): string {
  const intent = panel.buildPrompt.trim();
  // rtl-exempt: instructions to a model, not copy for a reader. Every line below is
  // addressed to Claude Code and names files, widget types and validator commands; it is
  // never rendered in the product and translating it would break the tool it drives.
  // Added by rtl-arabic-pdpl-specialist 2026-08-17 when check-rtl learned to see strings
  // in arrays and object literals — this is the one place in apps/web where that widening
  // finds prose that is genuinely not user-facing. (§1.4 · check-rtl.mjs rule 3b)
  return [
    `Rebuild the Command Center panel \`${panel.id}\` for AgnetOS.`,
    '',
    `Write a single JSON file at \`panels/${panel.id}.json\` that validates with \`node scripts/validate-panels.mjs\` against \`comms/contracts/panel-schema.md\`.`,
    '',
    `Intent: ${intent}`,
    '',
    'Rules:',
    '- Dashboards are data, not code. Do not add a React component for this center.',
    `- Only these widget types: ${PROMPT_WIDGET_TYPES}. Everything else composes from them (ADR-028).`,
    `- Reserved names with no schema yet, do not use: ${PROMPT_RESERVED_TYPES}. Never invent a new type.`,
    '- sql queries are registered names only. Never inline SQL.',
    '- No fabricated numbers. A signal with a digit must carry a query and a pending sentence.',
    '- sql-backed widgets must set emptyState naming the agent that will fill them.',
    '',
    'Current definition:',
    '',
    '```json',
    JSON.stringify(panel, null, 2),
    '```',
  ].join('\n');
}
