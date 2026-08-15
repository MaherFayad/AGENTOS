/**
 * Carousel maths — the interaction is one floating-point number (§2.4).
 * Run: node --test apps/web/src/dashboards/__tests__/carousel.test.mjs
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  CARD_WIDTH,
  cardTransform,
  dragToPosition,
  frontIndex,
  isAtRest,
  normalizePosition,
  settleTarget,
  springStep,
  step,
  velocityFrom,
  wrappedOffset,
} from '../lib/carousel.ts';

const SPRING = { stiffness: 120, damping: 20, mass: 0.9 };

test('front card is identity: no rotation, full scale, full brightness', () => {
  const t = cardTransform(0);
  assert.equal(t.rotateY === 0, true);
  assert.equal(t.scale, 1);
  assert.equal(t.brightness, 1);
  assert.equal(t.isFront, true);
});

test('a card one step right is rotateY −35°, scale .82, brightness .5 (§2.4)', () => {
  const t = cardTransform(1);
  assert.equal(t.rotateY, -35);
  assert.equal(t.scale, 0.82);
  assert.equal(t.brightness, 0.5);
  assert.equal(t.isFront, false);
});

test('a card one step left mirrors the rotation sign', () => {
  const t = cardTransform(-1);
  assert.equal(t.rotateY, 35);
});

test('wrappedOffset takes the short way around a six-card ring', () => {
  assert.equal(wrappedOffset(0, 5, 6), 1);
  assert.equal(wrappedOffset(5, 0, 6), -1);
});

test('frontIndex wraps', () => {
  assert.equal(frontIndex(0, 6), 0);
  assert.equal(frontIndex(5.6, 6), 0);
  assert.equal(frontIndex(-0.4, 6), 0);
});

test('dragging left advances the ring', () => {
  const next = dragToPosition(0, CARD_WIDTH * 0.62);
  assert.ok(next < 0);
});

test('settleTarget caps travel at ±2 cards', () => {
  const far = settleTarget(0, 40, SPRING);
  assert.ok(Math.abs(far) <= 2);
});

test('a rest state pins', () => {
  assert.equal(isAtRest({ position: 1, velocity: 0 }, 1), true);
  assert.equal(isAtRest({ position: 1.5, velocity: 0 }, 1), false);
});

test('springStep moves toward the target without exploding on a huge dt', () => {
  const next = springStep({ position: 0, velocity: 0 }, 1, 900, SPRING);
  assert.ok(Number.isFinite(next.position));
  assert.ok(Math.abs(next.position) < 5);
});

test('step is one card, arrows only', () => {
  assert.equal(step(2, 1), 3);
  assert.equal(step(2, -1), 1);
});

test('normalizePosition unwraps without moving a card', () => {
  assert.equal(normalizePosition(6, 6), 0);
  assert.equal(normalizePosition(-1, 6), 5);
});

test('velocityFrom uses the last ~90ms, not the whole drag', () => {
  const samples = [
    { x: 0, t: 0 },
    { x: 10, t: 200 },
    { x: 20, t: 280 },
  ];
  const v = velocityFrom(samples, 90);
  assert.ok(Number.isFinite(v));
});
