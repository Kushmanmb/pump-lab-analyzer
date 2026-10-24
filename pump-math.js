/* Exact combinatorial model of Pump: `pops` pop positions drawn uniformly without replacement from 25. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.PumpForecast = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const BOARD = 25;
  const HOUSE_RETURN = 0.98;
  const LEVELS = {
    easy: { pops: 1, max: 24 },
    medium: { pops: 3, max: 22 },
    hard: { pops: 5, max: 20 },
    expert: { pops: 10, max: 15 },
  };

  function choose(n, r) {
    if (r < 0 || r > n || n < 0) return 0n;
    r = Math.min(r, n - r);
    let out = 1n;
    for (let i = 1; i <= r; i++) out = (out * BigInt(n - r + i)) / BigInt(i);
    return out;
  }

  function ratio(a, b) {
    return Number((a * 10n ** 18n) / b) / 1e18;
  }

  function level(name) {
    const l = LEVELS[name];
    if (!l) throw new RangeError('Unknown difficulty: ' + name);
    return l;
  }

  // P(first k pumps are all safe) = C(25-k, pops) / C(25, pops)
  function survival(k, pops) {
    if (!Number.isInteger(k) || k < 0 || k > BOARD - pops) return 0;
    return ratio(choose(BOARD - k, pops), choose(BOARD, pops));
  }

  // P(first pop lands exactly on position j) = C(25-j, pops-1) / C(25, pops)
  function firstPopProbability(j, pops) {
    if (!Number.isInteger(j) || j < 1 || j > BOARD) return 0;
    return ratio(choose(BOARD - j, pops - 1), choose(BOARD, pops));
  }

  // P(pump k+1 pops | first k pumps safe) = pops / (25-k); null when k safe pumps is impossible.
  function conditionalPop(k, pops) {
    if (!Number.isInteger(k) || k < 0 || k > BOARD - pops) return null;
    return pops / (BOARD - k);
  }

  function payout(k, pops) {
    if (k === 0) return 1;
    const s = survival(k, pops);
    return s === 0 ? 0 : Math.round((HOUSE_RETURN / s + Number.EPSILON) * 100) / 100;
  }

  function distribution(name) {
    const { pops, max } = level(name);
    const rows = [];
    for (let pos = 1; pos <= BOARD; pos++) {
      rows.push({
        position: pos,
        firstPop: firstPopProbability(pos, pops),
        survive: survival(pos, pops),
        conditionalPop: conditionalPop(pos - 1, pops),
        payout: pos <= max ? payout(pos, pops) : 0,
        playable: pos <= max,
      });
    }
    return rows;
  }

  const MIN_AUDIT_ROUNDS = 30;

  // Entry: { difficulty, outcome: 'cashed'|'popped', pumps >= 1, target? }.
  // cashed: survived `pumps` pumps. popped: the balloon popped on pump number `pumps`.
  // Expected counts and z are only produced for rounds whose pre-declared `target` is resolvable,
  // and only once there are MIN_AUDIT_ROUNDS of them; otherwise they are null.
  function audit(entries) {
    let cashed = 0, popped = 0, tested = 0, hits = 0, expected = 0, variance = 0;
    for (const e of entries) {
      const l = LEVELS[e.difficulty];
      if (!l || !Number.isInteger(e.pumps) || e.pumps < 1 || e.pumps > l.max) continue;
      if (e.outcome === 'cashed') cashed++;
      else if (e.outcome === 'popped') popped++;
      else continue;
      const t = e.target;
      if (!Number.isInteger(t) || t < 1 || t > l.max) continue;
      let hit;
      if (e.outcome === 'cashed') hit = e.pumps >= t ? true : null;
      else hit = e.pumps > t;
      if (hit === null) continue;
      const p = survival(t, l.pops);
      tested++;
      if (hit) hits++;
      expected += p;
      variance += p * (1 - p);
    }
    const enough = tested >= MIN_AUDIT_ROUNDS && variance > 0;
    return {
      rounds: cashed + popped, cashed, popped, tested, hits,
      expected: enough ? expected : null,
      z: enough ? (hits - expected) / Math.sqrt(variance) : null,
    };
  }

  return { BOARD, HOUSE_RETURN, LEVELS, choose, survival, firstPopProbability, conditionalPop, payout, distribution, audit, MIN_AUDIT_ROUNDS };
});
