'use client';

import { ConnectionStatus } from './ConnectionStatus';
import { CostTicker } from './CostTicker';
import { ZoomControls } from './ZoomControls';

/**
 * §2.0 bottom corners: `? − [zoom%] +` bottom-left; bottom-right their Feedback pill
 * becomes the connection status, with the cost ticker beside it (§2.0 "Our two additions
 * to the shell").
 *
 * Both bottom-right pills use the same 10px wide-tracked monochrome type as everything
 * else in the chrome, so the addition reads as part of the original design rather than
 * a bolt-on.
 */
export function BottomBar(): React.JSX.Element {
  return (
    <div className="pointer-events-none flex items-end justify-between gap-3 pb-[calc(16px+env(safe-area-inset-bottom))] pl-[calc(20px+env(safe-area-inset-left))] pr-[calc(20px+env(safe-area-inset-right))]">
      <ZoomControls />
      <div className="flex flex-wrap items-center justify-end gap-2">
        <CostTicker />
        <ConnectionStatus />
      </div>
    </div>
  );
}
