/**
 * Honest empty — the graph payload is missing, so there is no map to count.
 * Never prints a node total. The canvas underneath still paints the sky.
 */

export function MapEmptyState({ message }: { message: string }): React.JSX.Element {
  return (
    <div
      data-testid="map-empty-state"
      className="pointer-events-none absolute inset-0 z-overlay grid place-items-center px-6"
    >
      <div className="max-w-[42ch] text-center">
        {/* A spec citation is a note to the builders, not a word for the person looking at
            an empty screen. The eyebrow names the view they are in. */}
        <p className="text-label-sm uppercase tracking-wider-3 text-ink-2">Map</p>
        <p className="mt-3 text-body font-semibold text-ivory-2">The galaxy is not built yet</p>
        <p className="mt-2 text-small text-ink-2">{message}</p>
      </div>
    </div>
  );
}
