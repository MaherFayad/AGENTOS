/**
 * Panel JSON → typed documents. No filesystem — safe to import from client code.
 *
 * Owner: dashboards-engineer · Spec §2.4–2.5
 */

import type { Panel, PanelSummary } from '@agnetos/contracts';

const PANEL_ID = /^[a-z][a-z0-9-]{2,63}$/;

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** Loose runtime guard — the validator is the schema; this only keeps the carousel up. */
export function asPanel(raw: unknown): Panel | null {
  if (!isRecord(raw)) return null;
  if (typeof raw.id !== 'string' || !PANEL_ID.test(raw.id)) return null;
  if (typeof raw.title !== 'string' || raw.title.trim() === '') return null;
  if (typeof raw.caption !== 'string') return null;
  if (typeof raw.railTitle !== 'string') return null;
  if (typeof raw.provider !== 'string') return null;
  if (!Number.isInteger(raw.order)) return null;
  if (!Array.isArray(raw.kpis) || !Array.isArray(raw.signals) || !Array.isArray(raw.widgets))
    return null;
  return raw as unknown as Panel;
}

export function toSummary(panel: Panel): PanelSummary {
  return {
    id: panel.id,
    title: panel.title,
    caption: panel.caption,
    railTitle: panel.railTitle,
    provider: panel.provider,
    department: panel.department,
    order: panel.order,
    kpiCount: panel.kpis.length,
    widgetCount: panel.widgets.length,
  };
}

export function sortPanels<T extends { order: number }>(panels: readonly T[]): T[] {
  return [...panels].sort((a, b) => a.order - b.order);
}

/**
 * Accepts the runner's `{id, panel}` envelopes, a `{panels:[…]}` wrapper, a bare array,
 * or the documents themselves. One malformed entry is dropped, never the whole set.
 */
export function normalizePanelPayload(raw: unknown): Panel[] {
  const list: unknown[] = Array.isArray(raw)
    ? raw
    : isRecord(raw) && Array.isArray(raw.panels)
      ? raw.panels
      : raw
        ? [raw]
        : [];
  const out: Panel[] = [];
  for (const item of list) {
    if (!isRecord(item)) continue;
    const doc = isRecord(item.panel) ? item.panel : item;
    const panel = asPanel(doc);
    if (panel) out.push(panel);
  }
  return sortPanels(out);
}
