/** @vitest-environment jsdom */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { I18nProvider } from '@/i18n/provider';
import type { SearchItem } from '@/lib/search';

/**
 * `next/navigation` only. The composer takes its roster as a prop precisely so
 * this suite does not have to stand up the shell — see the note on
 * `AddressComposerProps.roster`.
 */
const push = vi.fn();
vi.mock('next/navigation', () => ({
  usePathname: () => '/p/agentos/threads',
  useRouter: () => ({ push, replace: vi.fn(), back: vi.fn(), forward: vi.fn(), refresh: vi.fn(), prefetch: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

const { AddressComposer } = await import('./AddressComposer');
const { rosterFrom } = await import('./lib/roster');

const dept = (id: string): SearchItem => ({ id, kind: 'department', label: id, href: '/map' });
const agent = (department: string, slug: string): SearchItem => ({
  id: `${department}/${slug}`,
  kind: 'agent',
  label: slug,
  department,
  href: '/map',
});

const SALES = rosterFrom(
  [dept('sales'), agent('sales', 'a'), agent('sales', 'b'), agent('sales', 'c'), agent('sales', 'd')],
  true,
);

function show(roster = SALES) {
  const view = render(
    <I18nProvider locale="en">
      <AddressComposer roster={roster} />
    </I18nProvider>,
  );
  const input = screen.getByRole('textbox');
  return {
    ...view,
    input,
    type: (line: string) => fireEvent.change(input, { target: { value: line } }),
    submit: () => fireEvent.submit(input.closest('form') as HTMLFormElement),
  };
}

beforeEach(() => {
  push.mockClear();
  vi.restoreAllMocks();
});

/* -------------------------------------------------------------------------- *
 * `@@` — the control that can spend N× money
 * -------------------------------------------------------------------------- */

describe('the fan-out confirm (BOARD · Plan §23.11 rule 7)', () => {
  it('does not send on submit — it raises a confirm that NAMES THE COUNT', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const view = show();
    view.type('@@sales ship it');
    view.submit();

    const dialog = await screen.findByRole('alertdialog');
    // The count, in the panel, in words — not a tooltip and not a hover, because
    // a thumb has no hover and a tooltip is not a decision.
    expect(dialog.textContent).toContain('4');
    expect(dialog.textContent).toContain('sales');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('opens with focus on CANCEL, so Enter and Space cannot fire the fan-out', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const view = show();
    view.type('@@sales ship it');
    view.submit();

    const dialog = await screen.findByRole('alertdialog');
    const cancel = within(dialog).getByRole('button', { name: /cancel/i });
    expect(document.activeElement).toBe(cancel);

    fireEvent.click(cancel);
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('is dismissable with Escape, and Escape does not fire the fan-out', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const view = show();
    view.type('@@sales ship it');
    view.submit();

    const dialog = await screen.findByRole('alertdialog');
    fireEvent.keyDown(dialog, { key: 'Escape' });
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('holds Tab between the two buttons, so the dismiss is never off-screen', async () => {
    const view = show();
    view.type('@@sales ship it');
    view.submit();

    const dialog = await screen.findByRole('alertdialog');
    const cancel = within(dialog).getByRole('button', { name: /cancel/i });
    const confirm = within(dialog).getByRole('button', { name: /open the thread/i });

    confirm.focus();
    fireEvent.keyDown(dialog, { key: 'Tab' });
    expect(document.activeElement).toBe(cancel);

    fireEvent.keyDown(dialog, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(confirm);
  });

  it('shows NO numeral when nobody counted the department', async () => {
    const view = show(new Map());
    view.type('@@sales ship it');
    view.submit();

    const dialog = await screen.findByRole('alertdialog');
    // A count nobody took is not a zero. `AddressBadge` draws `'unresolved'` with
    // no numeral, and the panel says so in a sentence rather than showing a `0`
    // that a reader would act on.
    expect(dialog.textContent).not.toMatch(/\b0\b/);
    expect(dialog.textContent).toMatch(/not been counted/i);
  });

  it('drops a raised confirm when the line changes underneath it', async () => {
    const view = show();
    view.type('@@sales ship it');
    view.submit();
    await screen.findByRole('alertdialog');

    view.type('@@finance ship it');
    // The panel named a count for a line that is no longer on screen. Keeping it
    // would leave a person confirming four runs against a different department.
    expect(screen.queryByRole('alertdialog')).toBeNull();
  });

  it('the confirm states that no run starts, as well as how many there would be', async () => {
    const view = show();
    view.type('@@sales ship it');
    view.submit();
    const dialog = await screen.findByRole('alertdialog');
    // Both facts. The count alone implies money moves; the refusal alone hides
    // what the address means.
    expect(dialog.textContent).toMatch(/No run starts today/i);
    expect(dialog.textContent).toMatch(/RUNNER_ANTHROPIC_API_KEY/);
  });
});

/* -------------------------------------------------------------------------- *
 * The three interrupt levels — two offered, one refused
 * -------------------------------------------------------------------------- */

describe('interrupt levels (thread-model §4.2)', () => {
  it('renders three and marks exactly one of them refused', () => {
    show();
    const radios = screen.getAllByRole('radio');
    expect(radios).toHaveLength(3);
    const refused = radios.filter((r) => r.getAttribute('aria-disabled') === 'true');
    expect(refused).toHaveLength(1);
    expect(refused[0]?.textContent).toMatch(/steer/i);
  });

  it('gives the refusal a STATED REASON, tied to the control and visible', () => {
    show();
    const steer = screen.getAllByRole('radio').find((r) => /steer/i.test(r.textContent ?? ''));
    const describedBy = steer?.getAttribute('aria-describedby');
    expect(describedBy).toBeTruthy();
    const reason = document.getElementById(describedBy as string);
    // Visible text, not a tooltip, not sr-only — a refusal a sighted person
    // cannot read is a control that just looks broken.
    expect(reason?.textContent).toMatch(/not available in this build/i);
    // And the reason must be true for a reader WITH a run in flight. The old
    // wording named "nothing is running on this thread", which is §4.2's
    // no-run-in-flight case; the runner refuses every steer either way.
    expect(reason?.textContent).not.toMatch(/nothing is running/i);
  });

  it('keeps the refused level focusable, so the reason is announced', () => {
    show();
    const steer = screen.getAllByRole('radio').find((r) => /steer/i.test(r.textContent ?? ''));
    // `aria-disabled`, never `disabled`: arrow keys skip a disabled radio and the
    // reason is then announced to nobody.
    expect(steer).not.toHaveProperty('disabled', true);
    expect(steer?.getAttribute('aria-disabled')).toBe('true');
  });

  it('cannot be selected', () => {
    show();
    const steer = screen.getAllByRole('radio').find((r) => /steer/i.test(r.textContent ?? ''));
    fireEvent.click(steer as HTMLElement);
    expect(steer?.getAttribute('aria-checked')).toBe('false');
    const note = screen.getAllByRole('radio').find((r) => /note/i.test(r.textContent ?? ''));
    expect(note?.getAttribute('aria-checked')).toBe('true');
  });
});

/* -------------------------------------------------------------------------- *
 * Arrow keys, in BOTH directions
 *
 * `MIRRORS['shell.segmentedControl']` — "tab order is reading order" — governs this
 * row as much as the shell's. The same defect shipped twice in M15 (`DepartmentTabs`,
 * `SegmentedControl`) and this group is the fourth site of the class; it had no key
 * handling at all while its own comment argued from what arrow keys do to a
 * `disabled` radio.
 *
 * The RTL half is the half that matters: an LTR-only pass is how the department bar
 * ran backwards in Arabic for the whole life of the file. `elementDirection` reads
 * `dir` off the rendered tree, so the wrapper below is the whole setup.
 * -------------------------------------------------------------------------- */

describe('interrupt levels — arrow keys follow reading order', () => {
  const inDirection = (dir: 'ltr' | 'rtl') => {
    render(
      <div dir={dir}>
        <I18nProvider locale={dir === 'rtl' ? 'ar' : 'en'}>
          <AddressComposer roster={SALES} />
        </I18nProvider>
      </div>,
    );
    const radios = screen.getAllByRole('radio');
    // Source order is INTERRUPT_LEVELS: note · steer · halt. The ROW reverses under
    // dir="rtl" as a flex row; the DOM order does not, which is exactly why a fixed
    // +1 on ArrowRight walks the wrong way.
    return { note: radios[0], steer: radios[1], halt: radios[2] };
  };

  it('ArrowRight walks forward in LTR', () => {
    const { note, steer } = inDirection('ltr');
    note.focus();
    fireEvent.keyDown(note, { key: 'ArrowRight' });
    expect(document.activeElement).toBe(steer);
  });

  it('ArrowRight walks BACKWARD in RTL, because the row does', () => {
    const { note, steer, halt } = inDirection('rtl');
    note.focus();
    // Backward from the first wraps to the last, which is what the reader sees
    // immediately to the right of `note` once the row has mirrored.
    fireEvent.keyDown(note, { key: 'ArrowRight' });
    expect(document.activeElement).toBe(halt);
    expect(document.activeElement).not.toBe(steer);
  });

  it('ArrowLeft walks forward in RTL', () => {
    const { note, steer } = inDirection('rtl');
    note.focus();
    fireEvent.keyDown(note, { key: 'ArrowLeft' });
    expect(document.activeElement).toBe(steer);
  });

  it('lands focus ON the refused rung without selecting it — in both directions', () => {
    for (const dir of ['ltr', 'rtl'] as const) {
      const { note, steer } = inDirection(dir);
      note.focus();
      fireEvent.keyDown(note, { key: dir === 'rtl' ? 'ArrowLeft' : 'ArrowRight' });
      // This is the whole reason `steer` is `aria-disabled` and not `disabled`.
      // A `disabled` control is skipped, and the reason tied to it by
      // `aria-describedby` is then announced to nobody.
      //
      // WHAT THIS ASSERTION CANNOT SEE, measured rather than assumed: planting
      // `disabled={refused}` on the button leaves this test GREEN, because jsdom
      // honours `.focus()` on a disabled element where a browser does not. So the
      // direction half below is proved here (a fixed `+1` turns it red) and the
      // `disabled` half is proved by "keeps the refused level focusable" above,
      // which asserts the attribute. Neither test covers both; saying so is
      // cheaper than a third one that also cannot.
      expect(document.activeElement).toBe(steer);
      expect(steer.getAttribute('aria-checked')).toBe('false');
      expect(note.getAttribute('aria-checked')).toBe('true');
      screen.getByRole('radiogroup').remove();
      document.body.innerHTML = '';
    }
  });

  it('keeps one tab stop, so the group is entered once and walked with arrows', () => {
    const { note, steer, halt } = inDirection('ltr');
    expect(note.tabIndex).toBe(0);
    expect(steer.tabIndex).toBe(-1);
    expect(halt.tabIndex).toBe(-1);
  });
});

/* -------------------------------------------------------------------------- *
 * The `@@` confirm, keyed in Arabic
 *
 * The dismiss paths above are exercised LTR. They are re-run here because a
 * keyboard check that has only ever been run in one of the two directions the
 * product ships in is not a check — that sentence is `chart/model/direction.ts`'s,
 * earned on a bug that lived for the whole life of a file.
 * -------------------------------------------------------------------------- */

describe('the fan-out confirm, in Arabic', () => {
  it('is dismissable from the keyboard without firing, under dir="rtl"', () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    render(
      <div dir="rtl">
        <I18nProvider locale="ar">
          <AddressComposer roster={SALES} />
        </I18nProvider>
      </div>,
    );
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: '@@sales look' } });
    fireEvent.submit(input.closest('form') as HTMLFormElement);

    const dialog = screen.getByRole('alertdialog');
    // Cancel takes focus on open, so Enter and Space cancel rather than commit.
    expect(document.activeElement).toBe(within(dialog).getAllByRole('button')[0]);

    fireEvent.keyDown(dialog, { key: 'Escape' });
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

/* -------------------------------------------------------------------------- *
 * What the composer may print
 * -------------------------------------------------------------------------- */

describe('the preview', () => {
  it('never prints a currency symbol, on any address', () => {
    const view = show();
    for (const line of ['@sales/a x', '#sales x', '@@sales x', 'x', '@a x']) {
      view.type(line);
      expect(document.body.textContent ?? '').not.toMatch(/[$£€]|USD/);
    }
  });

  it('says "at least" for # rather than a flat count', () => {
    const view = show();
    view.type('#sales look');
    expect(document.body.textContent).toMatch(/at least 1 run/i);
  });

  it('prints the parser’s own refusal, token included', () => {
    const view = show();
    view.type('&sales hello');
    expect(document.body.textContent).toContain('&sales');
    expect(document.body.textContent).toMatch(/Addresses start with @/);
  });

  it('will not send a line the parser refused', () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const view = show();
    view.type('&sales hello');
    view.submit();
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
