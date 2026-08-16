/**
 * Compose the Claude Code one-shot that rebuilds a panel (§2.5.1).
 *
 * The ghost button on the detail view copies this. The panel JSON is the source of
 * truth; the prompt tells the next session to write a file, not a component.
 *
 * Owner: dashboards-engineer · Spec §2.5.1
 */

import type { Panel } from '@agnetos/contracts';

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
    '- Exactly the seven widget types: bar-list, source-bar-list, area-chart, cost-table, data-table, progress-table, activity-feed.',
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
