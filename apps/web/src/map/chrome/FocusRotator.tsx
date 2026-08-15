'use client';

/**
 * §2.1 bottom-center: nearest department name with ‹ › to rotate focus.
 * Chrome is monochrome — these chevrons are not data ink.
 */

export function FocusRotator({
  label,
  onPrev,
  onNext,
  onSelect,
}: {
  label: string | null;
  onPrev: () => void;
  onNext: () => void;
  onSelect: () => void;
}): React.JSX.Element | null {
  if (!label) return null;

  return (
    <div
      data-testid="map-focus-rotator"
      className="pointer-events-auto absolute inset-x-0 bottom-20 z-overlay flex justify-center px-6"
    >
      <div className="flex items-center gap-4">
        <button
          type="button"
          aria-label="Focus previous department"
          onClick={onPrev}
          className="text-ivory-2 transition-colors hover:text-ivory focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-4 focus-visible:outline-line-2"
        >
          ‹
        </button>
        <button
          type="button"
          onClick={onSelect}
          className="font-serif italic font-normal text-kpi-sm uppercase tracking-wider-4 text-ivory-2 transition-opacity duration-hover ease-zoom hover:text-ivory focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-4 focus-visible:outline-line-2"
        >
          {label}
        </button>
        <button
          type="button"
          aria-label="Focus next department"
          onClick={onNext}
          className="text-ivory-2 transition-colors hover:text-ivory focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-4 focus-visible:outline-line-2"
        >
          ›
        </button>
      </div>
    </div>
  );
}
