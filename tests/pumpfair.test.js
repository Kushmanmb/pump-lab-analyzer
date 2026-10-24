'use strict';
const test = require('node:test');
const assert = require('node:assert');
const crypto = require('node:crypto');
const P = require('../js/pumpfair.js');

test('SHA-256 known vectors', () => {
  assert.strictEqual(P.sha256Hex(''), 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
  assert.strictEqual(P.sha256Hex('abc'), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  assert.strictEqual(P.sha256Hex('abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq'),
    '248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1');
});

test('HMAC-SHA256 RFC 4231 case 2', () => {
  assert.strictEqual(P.hmacSha256Hex('Jefe', 'what do ya want for nothing?'),
    '5bdcc146bf60754e6a042426089575c75a003f089d2739839dec58b964ec3843');
});

test('SHA-256 / HMAC match node crypto, including long keys and UTF-8', () => {
  for (const s of ['x'.repeat(55), 'x'.repeat(56), 'x'.repeat(64), 'héllo ✓', 'a'.repeat(300)]) {
    assert.strictEqual(P.sha256Hex(s), crypto.createHash('sha256').update(s).digest('hex'));
    assert.strictEqual(P.hmacSha256Hex(s, 'client:1:0'), crypto.createHmac('sha256', s).update('client:1:0').digest('hex'));
  }
});

test('byte stream and floats follow documented construction', () => {
  const server = 'a'.repeat(64), client = 'myClient', nonce = 7;
  const b = P.bytes(server, client, nonce, 40);
  const r0 = crypto.createHmac('sha256', server).update(`${client}:${nonce}:0`).digest();
  const r1 = crypto.createHmac('sha256', server).update(`${client}:${nonce}:1`).digest();
  assert.deepStrictEqual(Buffer.from(b.slice(0, 32)), r0);
  assert.deepStrictEqual(Buffer.from(b.slice(32, 40)), r1.subarray(0, 8));
  const f = P.floats(server, client, nonce, 1)[0];
  const expected = r0[0] / 256 + r0[1] / 65536 + r0[2] / 16777216 + r0[3] / 4294967296;
  assert.strictEqual(f, expected);
});

test('shuffle is a permutation of 0..24 and deterministic', () => {
  const o = P.shuffle('s'.repeat(64), 'c', 1);
  assert.strictEqual(o.length, 25);
  assert.deepStrictEqual([...o].sort((a, b) => a - b), [...Array(25).keys()]);
  assert.deepStrictEqual(o, P.shuffle('s'.repeat(64), 'c', 1));
});

test('reference example (regression vector)', () => {
  const server = '0'.repeat(64), client = 'pumplab';
  const o = P.shuffle(server, client, 1);
  const first = P.floats(server, client, 1, 1)[0];
  assert.strictEqual(o[0], Math.floor(first * 25));
  const easy = P.popResult(server, client, 1, 'easy');
  assert.strictEqual(easy.popPump, o[0] + 1);
  const expert = P.popResult(server, client, 1, 'expert');
  assert.strictEqual(expert.popPump, Math.min(...o.slice(0, 10)) + 1);
  assert.strictEqual(expert.popPoints.length, 10);
  // pinned values guard against accidental algorithm changes
  assert.deepStrictEqual(o.slice(0, 5), PINNED);
});
const PINNED = require('./pinned.json');

test('pop counts per difficulty', () => {
  assert.deepStrictEqual(Object.values(P.DIFFICULTIES).map(d => d.pops), [1, 3, 5, 10]);
});

test('probability math', () => {
  assert.strictEqual(P.survival('easy', 0), 1);
  assert.ok(Math.abs(P.survival('easy', 5) - 20 / 25) < 1e-12);
  assert.ok(Math.abs(P.survival('medium', 1) - 22 / 25) < 1e-12);
  const rows = P.table('hard');
  assert.ok(Math.abs(rows[0].conditionalRisk - 5 / 25) < 1e-12);
  assert.ok(Math.abs(rows[1].conditionalRisk - 5 / 24) < 1e-12);
  for (const d of Object.keys(P.DIFFICULTIES)) {
    const t = P.table(d);
    const sum = t.reduce((a, r) => a + r.popAtThisPump, 0);
    assert.ok(Math.abs(sum - 1) < 1e-9);
    assert.strictEqual(t[24].cumulativePop, 1);
  }
});

test('empirical pop distribution matches theory (easy, 2000 rounds)', () => {
  let n1 = 0;
  for (let i = 1; i <= 2000; i++) if (P.popResult('seed', 'c', i, 'medium').popPump === 1) n1++;
  const expected = 2000 * (1 - P.survival('medium', 1));
  assert.ok(Math.abs(n1 - expected) < 5 * Math.sqrt(expected));
});

test('server seed hash verification', () => {
  const seed = 'my-secret-seed';
  const hash = crypto.createHash('sha256').update(seed).digest('hex');
  assert.ok(P.verifySeedHash(seed, hash));
  assert.ok(P.verifySeedHash(seed, ' ' + hash.toUpperCase() + ' '));
  assert.ok(!P.verifySeedHash('other', hash));
});
