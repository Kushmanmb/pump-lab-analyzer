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

test('conditional pop risk never exceeds 100% and is null when unreachable', () => {
  for (const [name, { pops }] of Object.entries(M.LEVELS)) {
    for (const r of M.distribution(name)) {
      if (r.conditionalPop === null) assert.ok(r.position - 1 > 25 - pops, `${name} pos ${r.position}`);
      else assert.ok(r.conditionalPop > 0 && r.conditionalPop <= 1, `${name} pos ${r.position}: ${r.conditionalPop}`);
    }
  }
  assert.equal(M.conditionalPop(23, 3), null);
  assert.equal(M.conditionalPop(22, 3), 1);
  assert.equal(M.conditionalPop(24, 1), 1);
  assert.equal(M.conditionalPop(25, 1), null);
  assert.equal(M.conditionalPop(15, 10), 1);
  assert.equal(M.conditionalPop(16, 10), null);
  assert.equal(M.conditionalPop(-1, 3), null);
});

const rounds = (n, e) => Array.from({ length: n }, () => ({ difficulty: 'medium', ...e }));

test('audit counts cashouts and pops separately', () => {
  const a = M.audit([
    ...rounds(2, { pumps: 3, outcome: 'cashed' }),
    ...rounds(3, { pumps: 2, outcome: 'popped' }),
    { difficulty: 'medium', pumps: 0, outcome: 'popped' },
    { difficulty: 'bogus', pumps: 1, outcome: 'cashed' },
    { difficulty: 'easy', pumps: 99, outcome: 'cashed' },
    { difficulty: 'easy', pumps: 1, outcome: 'other' },
  ]);
  assert.equal(a.rounds, 5);
  assert.equal(a.cashed, 2);
  assert.equal(a.popped, 3);
});

test('audit never draws conclusions from post-hoc stopping targets', () => {
  const sample = M.audit([
    ...rounds(100, { pumps: 1, outcome: 'cashed', target: 1 }),
    ...rounds(30, { pumps: 2, outcome: 'popped', target: 2 }),
  ]);
  assert.equal(sample.rounds, 130);
  assert.equal(sample.cashed, 100);
  assert.equal(sample.popped, 30);
  assert.equal('expected' in sample, false);
  assert.equal('z' in sample, false);
  assert.equal('tested' in sample, false);
});

test('audit excludes invalid outcomes and impossible pump counts', () => {
  const a = M.audit([
    { difficulty: 'medium', pumps: 2, outcome: 'cashed' },
    { difficulty: 'medium', pumps: 8, outcome: 'popped' },
    { difficulty: 'medium', pumps: 23, outcome: 'popped' },
    { difficulty: 'medium', pumps: 0, outcome: 'cashed' },
    { difficulty: 'hard', pumps: 21, outcome: 'popped' },
    { difficulty: 'medium', pumps: 4, outcome: 'unknown' },
  ]);
  assert.deepEqual(a, { rounds: 2, cashed: 1, popped: 1, invalid: 4 });
});

test('unknown difficulty throws', () => assert.throws(() => M.distribution('nope'), RangeError));
