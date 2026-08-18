/**
 * REQ-DRW-MAILBOX — the composer's model.
 *
 * Two levels and a refusal, and every assertion here is about the difference between
 * *refused* and *unavailable-but-submittable*, or about the two facts the runner returns
 * that a composer is most likely to blur.
 *
 * Owner: drawer-engineer · Consumes: comms/contracts/thread-model.md §4.2–§4.5,
 * comms/contracts/api-contracts.md (thread rows)
 */

import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { INTERRUPT_LEVELS, THREAD_STATES, type ThreadState } from '@agnetos/contracts';
import { en } from '@/i18n';
import { STEER_DELIVERY } from '../primitives';
import {
  appendStateKey,
  canSend,
  composableLevels,
  DEFAULT_LEVEL,
  dispositionKey,
  outcomeKeys,
  refusedLevels,
  RUN_STREAM_CARRIES_THREAD_ID,
  type ComposableLevel,
} from './mailbox';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../../../..');

describe('the third level is refused, not offered', () => {
  it('offers exactly the two levels this build can deliver', () => {
    expect(composableLevels()).toEqual(['note', 'halt']);
  });

  it('presents exactly one refused level, and it is steer', () => {
    // Pinned as a set rather than "contains steer": `MailboxComposer` draws the refused
    // rung by naming `steer` explicitly, so a *second* refused level arriving would
    // otherwise pass through the composer undrawn — offered nowhere, refused nowhere,
    // and silent. This is the assertion that makes that impossible.
    expect(refusedLevels()).toEqual(['steer']);
  });

  it('accounts for every level the contract declares — none may go missing', () => {
    expect([...composableLevels(), ...refusedLevels()].sort()).toEqual([...INTERRUPT_LEVELS].sort());
  });

  it('starts on the cheapest level, not on the most disruptive one', () => {
    expect(DEFAULT_LEVEL).toBe('note');
    expect(composableLevels()).toContain(DEFAULT_LEVEL);
  });

  it('derives the refusal from STEER_DELIVERY rather than declaring it', () => {
    // The point of the derivation: the day `MID_RUN_STEER.supported` becomes true, this
    // composer offers a steer with no edit here. A literal `false` in mailbox.ts could
    // drift from the runner; a derivation cannot. Falsified by inverting the constant
    // during development — `composableLevels()` returned all three.
    expect(STEER_DELIVERY.supported).toBe(false);
    expect(composableLevels().includes('steer' as ComposableLevel)).toBe(STEER_DELIVERY.supported);
  });

  it('cannot even express a steer at the call site', () => {
    const level: ComposableLevel = 'note';
    expect(level).toBe('note');
    // @ts-expect-error `ComposableLevel` excludes 'steer' while STEER_DELIVERY.supported
    // is false. This directive becomes an *unused directive* — itself an error — the
    // moment it widens, so lifting the refusal cannot happen without this file being
    // read. Live under `npm run typecheck:tests`; it proved nothing before that existed.
    const refused: ComposableLevel = 'steer';
    expect(refused).toBe('steer');
  });
});

describe('the thread id gap is a pin, not a paragraph', () => {
  const apiContract = resolve(repoRoot, 'packages/contracts/src/api.ts');

  it('can still see the file it makes a claim about', () => {
    expect(
      existsSync(apiContract),
      `packages/contracts/src/api.ts is not at ${apiContract}. This pin has gone blind — ` +
        `fix the path rather than letting the assertion below pass on nothing.`,
    ).toBe(true);
  });

  it('reads SseStartData rather than trusting the constant', () => {
    const src = readFileSync(apiContract, 'utf8');
    const at = src.indexOf('export interface SseStartData');
    expect(at, 'SseStartData is no longer declared in api.ts — re-point this pin').toBeGreaterThan(-1);
    const body = src.slice(at, src.indexOf('\n}', at));

    // The instrument states what it cannot see: this matches a `threadId` *declaration*
    // in the interface body, so a field named `runThreadId`, or one added to `SseDoneData`
    // instead, would not trip it. Narrow on purpose — a substring match against the whole
    // file would have matched `RunRequest.threadId`, which has always existed, and the
    // pin would have been red from the day it was written.
    const declared = /^\s*threadId[?]?\s*:/m.test(body);

    expect(
      declared,
      declared
        ? 'SseStartData now carries a threadId. The producer has landed and the consumer ' +
          'has not: set RUN_STREAM_CARRIES_THREAD_ID to true and wire JobDrawer\'s ' +
          'mailboxThreadId to run.state.threadId in this same commit. M15 shipped a ' +
          'sourceRef producer whose consumer never landed and the drawer header read ' +
          'SOURCE UNKNOWN for every agent with nothing red anywhere.'
        : 'RUN_STREAM_CARRIES_THREAD_ID says the stream carries one and SseStartData does not.',
    ).toBe(RUN_STREAM_CARRIES_THREAD_ID);
  });
});

describe('disposition and thread state are two different facts', () => {
  it('gives queued and delivered-to-run different sentences', () => {
    const queued = dispositionKey('queued');
    const delivered = dispositionKey('delivered-to-run');
    expect(queued).not.toBe(delivered);
    expect(en[queued]).not.toBe(en[delivered]);
  });

  it('never says a message was merely "sent"', () => {
    // The blur this whole surface exists to refuse, one level down: a note that waits in
    // the mailbox and a note handed to a live run are two outcomes, and one word for both
    // is what lets a reader believe the wrong one.
    for (const disposition of ['queued', 'delivered-to-run'] as const) {
      expect(String(en[dispositionKey(disposition)]).toLowerCase()).not.toMatch(/\bsent\b/);
    }
  });

  it('has a sentence for every thread state the contract declares', () => {
    // A state with no key would render nothing at all, which reads as "the thread has no
    // state" rather than "we have no sentence" — the same class of silence as a dimmed
    // tab standing in for a failed read.
    for (const state of THREAD_STATES) {
      expect(en[appendStateKey(state)], `no sentence for thread state "${state}"`).toBeTruthy();
    }
    expect(new Set(THREAD_STATES.map(appendStateKey)).size).toBe(THREAD_STATES.length);
  });

  it('states the append-time reading in the past tense, in every state', () => {
    // `threadState` is the state as at the append — read before the message was written.
    // `api-contracts.md` used to say a halt moves the thread to `waiting`; the service
    // returns the earlier reading, and the composer author has only the contract. A
    // present-tense sentence here is that correction being undone.
    for (const state of THREAD_STATES) {
      const sentence = String(en[appendStateKey(state)]);
      expect(sentence, `"${state}" reads as the state after the append`).toMatch(/\bwas\b|\bhad\b/);
      expect(sentence).not.toMatch(/\bis now\b|\bhas moved\b/);
    }
  });
});

describe('what a sender is told afterwards', () => {
  const outcome = (interrupt: ComposableLevel, threadState: ThreadState = 'running') =>
    outcomeKeys({ disposition: 'delivered-to-run', threadState, interrupt });

  it('says where it went, what the state was, and that the state is as at the append', () => {
    expect(outcome('note')).toEqual([
      'threads.mailbox.disposition.deliveredToRun',
      'threads.mailbox.appendState.running',
      'threads.mailbox.appendStateCaveat',
    ]);
  });

  it('adds the halt caveat, because a halt lands after the response does', () => {
    // The one level whose visible effect arrives later than the answer. Without this a
    // reader sees "the thread was running" beside a halt and concludes it did not take.
    expect(outcome('halt')).toContain('threads.mailbox.haltNotYetMoved');
    expect(outcome('note')).not.toContain('threads.mailbox.haltNotYetMoved');
  });

  it('never promises a state the runner has not reached', () => {
    const sentences = outcome('halt', 'running').map((key) => String(en[key]).toLowerCase());
    expect(sentences.some((s) => s.includes('waiting'))).toBe(false);
    expect(sentences.some((s) => s.includes('stopped'))).toBe(false);
  });
});

describe('the body', () => {
  it('refuses an empty or whitespace-only message', () => {
    expect(canSend('')).toBe(false);
    expect(canSend('   \n\t ')).toBe(false);
    expect(canSend('use the Q3 numbers')).toBe(true);
  });
});

describe('no figure can reach this surface', () => {
  it('has no currency symbol or decimal amount in any mailbox string', () => {
    // BOARD rule 9. `TurnCost.estimatedUsd` is typed `null` and zero runs have completed,
    // so there is nothing to average — and a composer is exactly where a plausible number
    // gets believed. `i18n.test.ts` holds the same line for `threads.` as a whole; this
    // one is scoped to the keys added here so a failure names the right owner.
    for (const [key, value] of Object.entries(en)) {
      if (!key.startsWith('threads.mailbox.')) continue;
      expect(JSON.stringify(value), `${key} carries a figure`).not.toMatch(/[$€£]|\d+\.\d/);
    }
  });
});
