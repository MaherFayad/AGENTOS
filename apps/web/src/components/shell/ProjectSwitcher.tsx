'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useI18n } from '@/i18n';
import { GlassPanel } from './ui';
import { switchProjectHref } from './route';
import { useShell } from './ShellContext';
import type { ProjectRow } from './useProjects';

/**
 * `Plan §23.10` top-left: the project switcher, **before** the fullscreen toggle.
 *
 * ## Where it sits, and why the centre line does not move
 *
 * It joins the existing left cluster inside `TopBar`'s
 * `grid-cols-[1fr_auto_1fr]`. That grid is load-bearing and untouched: the centre column
 * is `auto`, so it is sized by the segmented control alone, and the two `1fr` columns
 * split whatever is left **symmetrically**. Adding weight to the left cluster therefore
 * moves nothing but the left cluster — the tabs stay on the true centre line of the
 * viewport, which is the same mechanism that let SESSIONS become a fourth tab without
 * disturbing §2.0.
 *
 * `Plan §23.5` is explicit that the centre column's budget is spent: four wide-tracked
 * labels measure ~400px and six will not fit, which is why THREADS and CALENDAR go to the
 * right cluster later. **This control spends none of that budget.** It adds no tab, and
 * it is not a tab.
 *
 * ## What one project honestly looks like
 *
 * There is exactly one project, no run has ever executed, and `GET /api/projects` may not
 * be built on the runner you are talking to. So the picker is written for the case where
 * it can prove nothing:
 *
 * - The pill shows the slug from the **URL**, because that is the only thing that is
 *   certainly true about which project you are looking at.
 * - It shows the coordinator's *name* for it only once the coordinator has confirmed the
 *   slug exists. Until then the slug stands unadorned and the panel says why.
 * - A list with one row says so, in words, rather than presenting a menu that implies a
 *   choice. **A switcher with one entry cannot demonstrate that switching scopes
 *   anything** and it must not look like it has.
 * - `scopeEnforced: false` — the coordinator telling us its own database isolation is
 *   inert — is printed. An isolation guarantee whose status nobody can see is a claim.
 *
 * ## Keyboard before pointer (`Plan §23.11` rule 7)
 *
 * `⌘K` / `Ctrl+K` opens from anywhere · `↓`/`↑` walk · `Home`/`End` jump · `Enter`
 * selects · `Esc` closes and returns focus to the trigger. The trigger is a real
 * `aria-haspopup="listbox"` button and the panel is a real `listbox`, so this control is
 * reachable and announceable without a pointer — the same standard `SearchPill` set for
 * the canvas.
 */

/** Trailing chevron. An SVG, not a glyph, so it inherits `currentColor` and flips in RTL. */
function Chevron({ open }: { open: boolean }): React.JSX.Element {
  return (
    <svg
      viewBox="0 0 12 12"
      width="9"
      height="9"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`shrink-0 text-ink-3 transition-transform duration-hover ease-reveal ${open ? 'rotate-180' : ''}`}
    >
      <path d="M2.5 4.5 6 8l3.5-3.5" />
    </svg>
  );
}

export function ProjectSwitcher(): React.JSX.Element {
  const router = useRouter();
  const { t } = useI18n();
  const { route, project } = useShell();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const listId = useId();

  const options: ProjectRow[] = project.options;
  const label = project.slug ?? t('shell.project.none');
  const displayed = project.confirmed && project.name ? project.name : label;

  const close = useCallback((returnFocus = true) => {
    setOpen(false);
    if (returnFocus) triggerRef.current?.focus();
  }, []);

  const choose = useCallback(
    (slug: string) => {
      close();
      if (slug === project.slug) return;
      router.push(switchProjectHref(route, slug));
    },
    [close, project.slug, route, router],
  );

  /** Open with the project you are already in pre-selected, not with row 0. */
  const reveal = useCallback(() => {
    setOpen(true);
    setActive(Math.max(0, options.findIndex((row) => row.slug === project.slug)));
  }, [options, project.slug]);

  // ⌘K / Ctrl+K from anywhere — `Plan §23.10` calls this the highest-frequency control in
  // the app, and the highest-frequency control cannot require a pointer to reach.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== 'k' && event.key !== 'K') return;
      if (!event.metaKey && !event.ctrlKey) return;
      event.preventDefault();
      reveal();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [reveal]);

  /**
   * The list takes focus when it opens, and `aria-activedescendant` lives on the list.
   *
   * That is the APG listbox pattern rather than a stylistic choice: `aria-activedescendant`
   * is only meaningful on the element that *has* focus, and putting it on a `<button>`
   * whose implicit role is `button` is unsupported — a screen reader would announce the
   * trigger and never the option the arrow keys are moving through. The trigger keeps only
   * the keys that *open*; everything after that is the list's.
   */
  useEffect(() => {
    if (open) listRef.current?.focus();
  }, [open]);

  const onTriggerKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLButtonElement>) => {
      if (event.key === 'Escape' && open) {
        event.preventDefault();
        close();
        return;
      }
      if (options.length === 0) return;
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        reveal();
      }
    },
    [open, options.length, close, reveal],
  );

  const onListKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLUListElement>) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        close();
        return;
      }
      if (options.length === 0) return;
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        const step = event.key === 'ArrowDown' ? 1 : -1;
        setActive((index) => (index + step + options.length) % options.length);
      } else if (event.key === 'Home') {
        event.preventDefault();
        setActive(0);
      } else if (event.key === 'End') {
        event.preventDefault();
        setActive(options.length - 1);
      } else if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        const chosen = options[active];
        if (chosen) choose(chosen.slug);
      }
    },
    [options, active, choose, close],
  );

  return (
    <div className="relative shrink-0">
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        // The accessible name states the scope in full, because the visible pill is a
        // truncated slug and a screen reader user has no tooltip to fall back on.
        // ONE KEY PER STATE, never a clause chosen inside the sentence: the confirmation
        // clause inflects in Arabic and "Change project." does not necessarily go last.
        aria-label={t(
          project.confirmed ? 'shell.project.aria.confirmed' : 'shell.project.aria.unconfirmed',
          { project: displayed },
        )}
        title={project.message ?? t('shell.project.title', { project: displayed })}
        onClick={() => (open ? close(false) : reveal())}
        onKeyDown={onTriggerKeyDown}
        data-project-confirmed={project.confirmed}
        className="flex h-8 max-w-[92px] shrink-0 items-center gap-1.5 rounded-pill border border-line bg-card px-2.5 text-label-sm uppercase tracking-wider-1 text-ivory-2 transition-colors hover:border-line-2 hover:text-ivory focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-line-2 min-[420px]:max-w-[120px] sm:max-w-[190px] sm:px-3"
      >
        <span className="truncate">{displayed}</span>
        {/* An unconfirmed scope is marked in the visible pill, not only in the tooltip:
            a phone has no hover, and "which project is this" is the one question the
            chrome must never answer more confidently than it can. */}
        {!project.confirmed && (
          <span aria-hidden="true" className="shrink-0 text-ink-3">
            ?
          </span>
        )}
        <Chevron open={open} />
      </button>

      {open && (
        <div className="absolute start-0 top-[38px] z-drawer w-[268px]">
          <GlassPanel radius="md" shadow="drawer" className="block overflow-hidden p-1">
            <ul
              ref={listRef}
              id={listId}
              role="listbox"
              tabIndex={-1}
              aria-label={t('shell.project.list')}
              aria-activedescendant={options[active] ? `${listId}-${active}` : undefined}
              onKeyDown={onListKeyDown}
              className="max-h-[280px] overflow-y-auto focus:outline-none"
            >
              {options.map((row, index) => (
                <li key={row.slug}>
                  <button
                    type="button"
                    id={`${listId}-${index}`}
                    role="option"
                    aria-selected={row.slug === project.slug}
                    onMouseEnter={() => setActive(index)}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => choose(row.slug)}
                    className={`flex w-full items-baseline gap-2 rounded-[10px] px-3 py-2 text-start transition-colors ${
                      index === active ? 'bg-card-2' : 'bg-transparent'
                    }`}
                  >
                    <span className="min-w-0 flex-1 truncate text-small text-ivory-2">{row.name}</span>
                    <span className="shrink-0 text-label-sm uppercase tracking-wider-1 text-ink-3">
                      {/* `mounted` is the coordinator's own statement about which library
                          it has on disk. A row it lists but cannot serve is a real state
                          (`host_affinity`, Plan §9) and says so rather than 404ing later. */}
                      {row.status !== 'active'
                        ? row.status
                        : t(row.mounted ? 'shell.project.mounted' : 'shell.project.elsewhere')}
                    </span>
                  </button>
                </li>
              ))}

              {options.length === 0 && (
                <li className="px-3 py-3 text-meta text-ink-2">
                  {project.message ?? t('shell.project.empty')}
                </li>
              )}
            </ul>

            <FooterNote
              count={options.length}
              scopeEnforced={project.scopeEnforced}
              unconfirmed={project.slug !== null && !project.confirmed ? project.message : null}
            />
          </GlassPanel>
        </div>
      )}

      {/* Closing on outside click without a document listener that would also swallow the
          trigger's own click: a transparent sibling behind the panel. */}
      {open && (
        <button
          type="button"
          tabIndex={-1}
          aria-hidden="true"
          onMouseDown={() => close(false)}
          className="fixed inset-0 z-chrome cursor-default"
        />
      )}
    </div>
  );
}

/**
 * The honest footer. Three sentences at most, and every one of them is a fact the
 * coordinator supplied or an absence it admitted.
 *
 * The one-project line is the shell's copy of `project-scoping.md` §6: with a single
 * project, *"a switcher with one entry cannot demonstrate that switching scopes
 * anything."* Saying so on screen is cheaper than a reader inferring, from a menu, that
 * isolation has been shown to work.
 */
function FooterNote({
  count,
  scopeEnforced,
  unconfirmed,
}: {
  count: number;
  scopeEnforced: boolean | null;
  unconfirmed: string | null;
}): React.JSX.Element | null {
  const { t } = useI18n();
  const lines: string[] = [];

  if (unconfirmed) lines.push(unconfirmed);
  if (count === 1) lines.push(t('shell.project.onlyOne'));
  if (scopeEnforced === false) {
    lines.push(t('shell.project.isolationOff'));
  } else if (scopeEnforced === null && count > 0) {
    lines.push(t('shell.project.isolationUnknown'));
  }

  if (lines.length === 0) return null;

  return (
    <p className="border-t border-line px-3 py-2 text-meta text-ink-2">
      {lines.map((line, index) => (
        <span key={index} className="block first:mt-0 [&+span]:mt-1.5">
          {line}
        </span>
      ))}
    </p>
  );
}
