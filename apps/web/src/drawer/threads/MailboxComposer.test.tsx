/**
 * REQ-DRW-MAILBOX — the composer, rendered.
 *
 * The model tests hold the arithmetic; these hold the thing a person actually sees. The
 * assertion that matters most is negative: **there is no control on this form that sends a
 * steer**, in any state, with or without a run in flight.
 *
 * `fireEvent`, not `user-event`: this repo does not depend on the latter and one
 * assertion is not a reason to add a dependency (Part V).
 *
 * Owner: drawer-engineer
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { PostThreadMessageResponse } from '@agnetos/contracts';
import { I18nProvider } from '@/i18n/provider';
import { en } from '@/i18n';
import { MailboxComposer, type Sender } from './MailboxComposer';

const reply = (over: Partial<PostThreadMessageResponse> = {}): PostThreadMessageResponse => ({
  message: { id: 'm1', seq: 4, kind: 'human', interrupt: 'note', createdAt: '2026-08-18T00:00:00Z' },
  disposition: 'queued',
  threadState: 'open',
  ...over,
});

function show(threadId: string | null, send: Sender = vi.fn(async () => reply())) {
  const view = render(
    <I18nProvider locale="en">
      <MailboxComposer threadId={threadId} send={send} />
    </I18nProvider>,
  );
  return { send, ...view };
}

const body = () => screen.getByRole('textbox') as HTMLTextAreaElement;
const sendButton = () => screen.getByRole('button', { name: en['threads.mailbox.send'] });
const type = (text: string) => fireEvent.change(body(), { target: { value: text } });

describe('two levels are offered and the third is drawn as refused', () => {
  it('offers exactly two, and neither of them is a steer', () => {
    const { container } = show('t1');
    const radios = [...container.querySelectorAll('input[type="radio"]')] as HTMLInputElement[];
    expect(radios.map((r) => r.value)).toEqual(['note', 'halt']);
  });

  it('has no form control anywhere that could submit a steer', () => {
    // The whole scope change in one assertion. A composer that offered three levels and
    // handled the 409 would pass every other test in this file.
    const { container } = show('t1');
    for (const el of container.querySelectorAll('input, button, select, option, textarea')) {
      expect((el as HTMLInputElement).value ?? '').not.toBe('steer');
    }
  });

  it('draws the refused level rather than hiding it', () => {
    // Absent would be its own lie: thread-model §4.2 lists three levels, so a reader who
    // sees two concludes the third is coming or that they missed it.
    const { container } = show('t1');
    expect(container.textContent).toContain('Steer');
    expect(container.querySelector('.border-dashed')).toBeTruthy();
  });

  it('states the runner’s reason, not the level’s condition', () => {
    // The copy was wrong once: it named thread-model §4.2's no-run-in-flight case, which
    // told a reader *with* a run in flight that the refusal did not apply to them. The
    // composer renders the catalogue key rather than a paraphrase, so the two cannot drift.
    const { container } = show('t1');
    expect(container.textContent).toContain(en['a11y.threads.interrupt.undeliverable']);
    expect(container.textContent).not.toContain('Nothing is running on this thread');
  });

  it('says it in one voice, not two', () => {
    // The badge announces the sentence to a screen reader; the visible copy is the same
    // key, marked aria-hidden so it is not read twice. Two sentences saying one thing are
    // two things to correct, and this one has already been corrected once.
    const { container } = show('t1');
    const occurrences = container.innerHTML.split(en['a11y.threads.interrupt.undeliverable']).length - 1;
    expect(occurrences).toBe(2);
    expect(container.querySelector('[aria-hidden="true"]')).toBeTruthy();
  });
});

describe('with no thread to address', () => {
  it('disables the form and says why, instead of collapsing', () => {
    const { container } = show(null);
    expect(container.textContent).toContain(en['threads.mailbox.noThread']);
    expect(body().disabled).toBe(true);
    expect((sendButton() as HTMLButtonElement).disabled).toBe(true);
    // The radios are disabled by their `<fieldset disabled>`, which is inherited rather
    // than reflected: `input.disabled` stays `false` and only `:disabled` matches. Asserted
    // through the selector for that reason — the first draft of this test read `.disabled`
    // and would have passed on a fieldset that was not disabled at all.
    expect((container.querySelector('fieldset') as HTMLFieldSetElement).disabled).toBe(true);
    for (const radio of container.querySelectorAll('input[type="radio"]')) {
      expect(radio.matches(':disabled')).toBe(true);
    }
  });

  it('still shows the refusal, because the refusal is not about the address', () => {
    const { container } = show(null);
    expect(container.textContent).toContain(en['a11y.threads.interrupt.undeliverable']);
  });

  it('says nothing about a missing thread once there is one', () => {
    const { container } = show('t1');
    expect(container.textContent).not.toContain(en['threads.mailbox.noThread']);
    expect(body().disabled).toBe(false);
  });
});

describe('sending', () => {
  it('sends the declared level with the body, and clears the body after', async () => {
    const send = vi.fn<Sender>(async () =>
      reply({ disposition: 'delivered-to-run', threadState: 'running' }),
    );
    show('thread-9', send);

    type('use the Q3 numbers');
    fireEvent.click(screen.getByRole('radio', { name: /stops the work/i }));
    fireEvent.click(sendButton());

    await waitFor(() =>
      expect(send).toHaveBeenCalledWith('thread-9', {
        body: 'use the Q3 numbers',
        interrupt: 'halt',
      }),
    );
    await waitFor(() => expect(body().value).toBe(''));
  });

  it('defaults to the cheapest level rather than the most disruptive one', async () => {
    const send = vi.fn<Sender>(async () => reply());
    show('t1', send);
    type('check the pricing page too');
    fireEvent.click(sendButton());
    await waitFor(() =>
      expect(send).toHaveBeenCalledWith('t1', {
        body: 'check the pricing page too',
        interrupt: 'note',
      }),
    );
  });

  it('will not send an empty body', () => {
    const send = vi.fn<Sender>(async () => reply());
    show('t1', send);
    expect((sendButton() as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(sendButton());
    expect(send).not.toHaveBeenCalled();
  });

  it('tells queued and delivered-to-run apart', async () => {
    const queued = show('t1', vi.fn<Sender>(async () => reply({ disposition: 'queued' })));
    type('a');
    fireEvent.click(sendButton());
    await waitFor(() =>
      expect(queued.container.textContent).toContain(en['threads.mailbox.disposition.queued']),
    );
    expect(queued.container.textContent).not.toContain(
      en['threads.mailbox.disposition.deliveredToRun'],
    );
    queued.unmount();

    const live = show('t1', vi.fn<Sender>(async () => reply({ disposition: 'delivered-to-run' })));
    type('a');
    fireEvent.click(sendButton());
    await waitFor(() =>
      expect(live.container.textContent).toContain(
        en['threads.mailbox.disposition.deliveredToRun'],
      ),
    );
  });

  it('does not claim a halt moved the thread', async () => {
    // The corrected contract: `threadState` is the state as at the append, and a halt does
    // not move it there — the run's next drain does. A composer rendering "now waiting"
    // off this field renders a state the runner has not reached.
    const send = vi.fn<Sender>(async () =>
      reply({ disposition: 'delivered-to-run', threadState: 'running' }),
    );
    const { container } = show('t1', send);

    type('stop');
    fireEvent.click(screen.getByRole('radio', { name: /stops the work/i }));
    fireEvent.click(sendButton());

    await waitFor(() =>
      expect(container.textContent).toContain(en['threads.mailbox.appendState.running']),
    );
    expect(container.textContent).toContain(en['threads.mailbox.haltNotYetMoved']);
    expect(container.textContent).not.toContain(en['threads.mailbox.appendState.waiting']);
  });

  it('shows the runner’s refusal sentence and never the body', async () => {
    const send = vi.fn<Sender>(async () => {
      throw new Error('This thread is closed.');
    });
    const { container } = show('t1', send);

    type('client Acme, contact ada@example.com');
    fireEvent.click(sendButton());

    const region = () => container.querySelector('[role="status"]') as HTMLElement;
    await waitFor(() => expect(region().textContent).toContain('This thread is closed.'));
    // `ops.message` is the highest-PII surface in this repo, and a body inside an error
    // string leaks past every key-based redactor (the flattening finding). The failure
    // line is the runner's sentence and nothing else.
    //
    // Scoped to the live region on purpose: the body is still in the textarea, because a
    // failed send must not throw away what the person typed. Asserting over the whole
    // container would have been an instrument that could not tell "the composer echoed the
    // body into an error" from "the composer kept the draft".
    expect(region().textContent).not.toContain('ada@example.com');
    expect(body().value).toContain('ada@example.com');
  });

  it('announces the outcome politely rather than moving focus', () => {
    const { container } = show('t1');
    expect(container.querySelector('[role="status"]')?.getAttribute('aria-live')).toBe('polite');
  });
});
