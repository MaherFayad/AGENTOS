import type { ReactNode } from 'react';

/**
 * The empty state a route shows before its owning agent has mounted a view into it.
 *
 * This exists so the routing skeleton is walkable today without anyone inventing a fake
 * map or a demo dashboard. It says what will be here, who is building it, and which spec
 * section it comes from — an honest empty state beats a plausible fake one
 * (standing rule 9).
 *
 * **Replacing one is the point:** the owning agent swaps `<ViewMount …/>` in
 * `app/(views)/…/page.tsx` for their component. Nothing else in the shell changes.
 */
export function ViewMount({
  title,
  owner,
  spec,
  children,
}: {
  title: string;
  owner: string;
  spec: string;
  children?: ReactNode;
}): React.JSX.Element {
  return (
    <div className="grid h-full w-full place-items-center px-6">
      <div className="max-w-[380px] text-center">
        <p className="text-label-sm uppercase tracking-wider-3 text-ink-3">{spec}</p>
        <h1 className="mt-3 text-body font-semibold text-ivory-2">{title}</h1>
        <p className="mt-2 text-small text-ink-2">{children}</p>
        <p className="mt-4 text-label uppercase tracking-wider-1 text-ink-3">BUILT BY {owner}</p>
      </div>
    </div>
  );
}
