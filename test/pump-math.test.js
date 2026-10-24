'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const M = require('../pump-math.js');

const close = (a, b, eps = 1e-12) => assert.ok(Math.abs(a - b) < eps, `${a} !~ ${b}`);

test('known survival values', () => {
  close(M.survival(1, 3), 22 / 25);
  close(M.survival(2, 3), (22 / 25) * (21 / 24));
  close(M.survival(0, 10), 1);
  assert.equal(M.survival(23, 3), 0);
});

test('first-pop distribution sums to 1 for every difficulty', () => {
  for (const [name, { pops }] of Object.entries(M.LEVELS)) {
    const sum = M.distribution(name).reduce((s, r) => s + r.firstPop, 0);
    close(sum, 1, 1e-9);
    close(M.firstPopProbability(1, pops), pops / 25);
  }
});

test('first-pop probabilities are consistent with survival', () => {
  for (const { pops } of Object.values(M.LEVELS)) {
    for (let j = 1; j <= 25; j++) close(M.firstPopProbability(j, pops), M.survival(j - 1, pops) - M.survival(j, pops), 1e-12);
  }
});

test('conditional risk equals pops / remaining and chains to survival', () => {
  for (const { pops } of Object.values(M.LEVELS)) {
    let p = 1;
    for (let k = 0; k <= 25 - pops; k++) {
      close(M.survival(k, pops), p, 1e-12);
      close(M.conditionalPop(k, pops), pops / (25 - k));
      p *= 1 - M.conditionalPop(k, pops);
    }
  }
});

test('payout is 0.98 / survival, rounded to cents', () => {
  assert.equal(M.payout(0, 3), 1);
  assert.equal(M.payout(1, 3), 1.11);
  assert.equal(M.payout(1, 1), 1.02);
  assert.equal(M.payout(1, 10), 1.63);
});

test('maximum pumps match difficulty definitions', () => {
  for (const { pops, max } of Object.values(M.LEVELS)) assert.ok(M.survival(max, pops) > 0);
  assert.equal(M.LEVELS.easy.pops, 1);
  assert.equal(M.LEVELS.medium.pops, 3);
  assert.equal(M.LEVELS.hard.pops, 5);
  assert.equal(M.LEVELS.expert.pops, 10);
});

test('exact enumeration agrees for a small identity', () => {
  assert.equal(M.choose(25, 3), 2300n);
  assert.equal(M.choose(5, 7), 0n);
});

test('audit compares outcomes with expectation and ignores invalid rows', () => {
  const a = M.audit([
    { difficulty: 'medium', pumps: 1, outcome: 'cashed' },
    { difficulty: 'medium', pumps: 1, outcome: 'popped' },
    { difficulty: 'bogus', pumps: 1, outcome: 'cashed' },
    { difficulty: 'easy', pumps: 99, outcome: 'cashed' },
  ]);
  assert.equal(a.rounds, 2);
  assert.equal(a.survived, 1);
  close(a.expected, 2 * 0.88);
});

test('unknown difficulty throws', () => assert.throws(() => M.distribution('nope'), RangeError));
