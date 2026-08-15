'use client';

import type { CostTableWidget } from '@agnetos/contracts';
import { sumOf, toCostRows } from '../lib/rows';
import { Formatted, QueryGate, WidgetChrome } from './widget-chrome';

export function CostTable({ widget }: { widget: CostTableWidget }): React.JSX.Element {
  return (
    <WidgetChrome title={widget.title} subtitle={widget.subtitle} span={widget.span}>
      <QueryGate query={widget.query} emptyState={widget.emptyState} height={160}>
        {(data) => {
          const rows = toCostRows(data);
          if (rows.length === 0) return <p className="text-meta text-ink-3">No rows.</p>;
          const total = sumOf(rows);
          return (
            <table className="w-full text-meta">
              <tbody>
                {rows.map((row, i) => (
                  <tr key={`${row.label}-${i}`} className="border-b border-line last:border-0">
                    <td className="py-2 pr-3 text-ivory-2">
                      {row.label}
                      {row.sub ? <span className="mt-0.5 block text-ink-3">{row.sub}</span> : null}
                    </td>
                    <td className="py-2 text-right text-ivory">
                      <Formatted value={row.value} format={widget.format ?? 'currency'} />
                    </td>
                  </tr>
                ))}
              </tbody>
              {widget.showTotal !== false ? (
                <tfoot>
                  <tr>
                    <th className="pt-3 text-left font-medium text-ivory-2">
                      {widget.totalLabel ?? 'Total'}
                    </th>
                    <td className="pt-3 text-right font-medium text-ivory">
                      <Formatted value={total} format={widget.format ?? 'currency'} />
                    </td>
                  </tr>
                </tfoot>
              ) : null}
            </table>
          );
        }}
      </QueryGate>
    </WidgetChrome>
  );
}
