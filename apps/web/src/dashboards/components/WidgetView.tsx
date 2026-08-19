'use client';

import type { Widget } from '@agnetos/contracts';
import { isWidgetType } from '@agnetos/contracts';
import { ActivityFeed } from './ActivityFeed';
import { AreaChart } from './AreaChart';
import { BarList } from './BarList';
import { Calendar } from './Calendar';
import { CostTable } from './CostTable';
import { DataTable } from './DataTable';
import { ProgressTable } from './ProgressTable';
import { ThreadFeed } from './ThreadFeed';
import { UnsupportedWidget, WidgetChrome } from './widget-chrome';

/**
 * One renderer for every panel. A new Command Center is a JSON file; if it needs a
 * new component, this switch is wrong.
 *
 * The `never` fallthrough is a safety property and ADR-028 caps how often it can be spent:
 * seven canonical types plus at most three extensions, ever. **Two of the three are spent**
 * — `thread-feed` in M16, `calendar` in M18, each on the milestone its data arrived in.
 * `board` is reserved and deliberately absent from `WidgetType`, so it arrives here through
 * `isWidgetType` returning false and renders the placeholder; an arm for a type nothing can
 * draw would spend the compiler's guarantee on nothing, and ADR-029's drag primitive — the
 * thing `board` is waiting for — is still unwritten.
 */
export function WidgetView({ widget }: { widget: Widget }): React.JSX.Element {
  if (!isWidgetType(widget.type)) {
    return (
      <WidgetChrome title={widget.title} span={widget.span}>
        <UnsupportedWidget type={String(widget.type)} />
      </WidgetChrome>
    );
  }
  switch (widget.type) {
    case 'bar-list':
    case 'source-bar-list':
      return <BarList widget={widget} />;
    case 'area-chart':
      return <AreaChart widget={widget} />;
    case 'cost-table':
      return <CostTable widget={widget} />;
    case 'data-table':
      return <DataTable widget={widget} />;
    case 'progress-table':
      return <ProgressTable widget={widget} />;
    case 'activity-feed':
      return <ActivityFeed widget={widget} />;
    case 'thread-feed':
      return <ThreadFeed widget={widget} />;
    case 'calendar':
      return <Calendar widget={widget} />;
    default: {
      const _never: never = widget;
      return (
        <WidgetChrome title="Unknown" span={1}>
          <UnsupportedWidget type={String(_never)} />
        </WidgetChrome>
      );
    }
  }
}
