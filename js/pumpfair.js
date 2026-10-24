/* Pump Lab core: SHA-256, HMAC-SHA256, Stake-style provably fair Pump events, probability math.
   Pure synchronous JS (no crypto.subtle) so it works on file:// and in Node for tests. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.PumpFair = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var POSITIONS = 25;
  var DIFFICULTIES = {
    easy: { label: 'Easy', pops: 1 },
    medium: { label: 'Medium', pops: 3 },
    hard: { label: 'Hard', pops: 5 },
    expert: { label: 'Expert', pops: 10 }
  };

  var K = new Uint32Array([
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
  ]);

  function utf8(str) {
    if (typeof TextEncoder !== 'undefined') return new TextEncoder().encode(str);
    var s = unescape(encodeURIComponent(str)), out = new Uint8Array(s.length);
    for (var i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
    return out;
  }

  function rotr(x, n) { return (x >>> n) | (x << (32 - n)); }

  /** SHA-256 of a Uint8Array -> Uint8Array(32). */
  function sha256Bytes(data) {
    var h = new Uint32Array([0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
      0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19]);
    var len = data.length;
    var padded = new Uint8Array(((len + 9 + 63) >> 6) << 6);
    padded.set(data);
    padded[len] = 0x80;
    var view = new DataView(padded.buffer);
    view.setUint32(padded.length - 8, Math.floor((len * 8) / 4294967296), false);
    view.setUint32(padded.length - 4, (len * 8) >>> 0, false);
    var w = new Uint32Array(64);
    for (var off = 0; off < padded.length; off += 64) {
      var i;
      for (i = 0; i < 16; i++) w[i] = view.getUint32(off + i * 4, false);
      for (i = 16; i < 64; i++) {
        var s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3);
        var s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
        w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
      }
      var a = h[0], b = h[1], c = h[2], d = h[3], e = h[4], f = h[5], g = h[6], hh = h[7];
      for (i = 0; i < 64; i++) {
        var S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
        var ch = (e & f) ^ (~e & g);
        var t1 = (hh + S1 + ch + K[i] + w[i]) >>> 0;
        var S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
        var maj = (a & b) ^ (a & c) ^ (b & c);
        var t2 = (S0 + maj) >>> 0;
        hh = g; g = f; f = e; e = (d + t1) >>> 0;
        d = c; c = b; b = a; a = (t1 + t2) >>> 0;
      }
      h[0] += a; h[1] += b; h[2] += c; h[3] += d; h[4] += e; h[5] += f; h[6] += g; h[7] += hh;
    }
    var out = new Uint8Array(32), ov = new DataView(out.buffer);
    for (var j = 0; j < 8; j++) ov.setUint32(j * 4, h[j], false);
    return out;
  }

  function toHex(bytes) {
    var s = '';
    for (var i = 0; i < bytes.length; i++) s += (bytes[i] < 16 ? '0' : '') + bytes[i].toString(16);
    return s;
  }

  function sha256Hex(str) { return toHex(sha256Bytes(utf8(str))); }

  function hmacSha256Bytes(keyBytes, msgBytes) {
    if (keyBytes.length > 64) keyBytes = sha256Bytes(keyBytes);
    var ipad = new Uint8Array(64 + msgBytes.length), opad = new Uint8Array(96);
    for (var i = 0; i < 64; i++) {
      var kb = i < keyBytes.length ? keyBytes[i] : 0;
      ipad[i] = kb ^ 0x36;
      opad[i] = kb ^ 0x5c;
    }
    ipad.set(msgBytes, 64);
    opad.set(sha256Bytes(ipad), 64);
    return sha256Bytes(opad);
  }

  function hmacSha256Hex(key, message) {
    return toHex(hmacSha256Bytes(utf8(key), utf8(message)));
  }

  /** Stake byte stream: HMAC_SHA256(serverSeed, `${clientSeed}:${nonce}:${round}`), 32 bytes per round. */
  function bytes(serverSeed, clientSeed, nonce, count) {
    var out = new Uint8Array(count), key = utf8(serverSeed);
    for (var round = 0; round * 32 < count; round++) {
      var chunk = hmacSha256Bytes(key, utf8(clientSeed + ':' + nonce + ':' + round));
      for (var i = 0; i < 32 && round * 32 + i < count; i++) out[round * 32 + i] = chunk[i];
    }
    return out;
  }

  /** Floats in [0,1): every 4 bytes -> sum(byte_i / 256^(i+1)). */
  function floats(serverSeed, clientSeed, nonce, count) {
    var b = bytes(serverSeed, clientSeed, nonce, count * 4), out = [];
    for (var n = 0; n < count; n++) {
      var v = 0;
      for (var i = 0; i < 4; i++) v += b[n * 4 + i] / Math.pow(256, i + 1);
      out.push(v);
    }
    return out;
  }

  /** Shuffle of positions 0..24: at step i take index floor(float * (25 - i)) of the remaining list. */
  function shuffle(serverSeed, clientSeed, nonce) {
    var f = floats(serverSeed, clientSeed, nonce, POSITIONS - 1);
    var remaining = [], order = [], i;
    for (i = 0; i < POSITIONS; i++) remaining.push(i);
    for (i = 0; i < POSITIONS - 1; i++) order.push(remaining.splice(Math.floor(f[i] * (POSITIONS - i)), 1)[0]);
    order.push(remaining[0]);
    return order;
  }

  /** Result for a round. popPump is 1-based: the pump number on which the balloon pops. */
  function popResult(serverSeed, clientSeed, nonce, difficulty) {
    var d = DIFFICULTIES[difficulty];
    if (!d) throw new Error('Unknown difficulty: ' + difficulty);
    var order = shuffle(serverSeed, clientSeed, nonce);
    var popPoints = order.slice(0, d.pops).sort(function (x, y) { return x - y; });
    return { difficulty: difficulty, pops: d.pops, popPoints: popPoints.map(function (p) { return p + 1; }), popPump: popPoints[0] + 1 };
  }

  function choose(n, k) {
    if (k < 0 || k > n) return 0;
    var r = 1;
    for (var i = 1; i <= k; i++) r = (r * (n - k + i)) / i;
    return Math.round(r);
  }

  /** Probability the first k pumps are all safe (k = 0..25-pops). */
  function survival(difficulty, k) {
    var n = DIFFICULTIES[difficulty].pops;
    return choose(POSITIONS - k, n) / choose(POSITIONS, n);
  }

  /** Probability table for pumps 1..25. Pumps beyond 25-pops+... are impossible-to-survive (risk 1). */
  function table(difficulty) {
    var n = DIFFICULTIES[difficulty].pops, rows = [];
    for (var k = 1; k <= POSITIONS; k++) {
      var prev = survival(difficulty, k - 1), cur = survival(difficulty, k);
      rows.push({
        pump: k,
        survive: cur,
        cumulativePop: 1 - cur,
        popAtThisPump: prev - cur,
        conditionalRisk: prev > 0 ? (prev - cur) / prev : 1,
        reachable: prev > 0,
        pops: n
      });
    }
    return rows;
  }

  function verifySeedHash(serverSeed, expectedHash) {
    return sha256Hex(serverSeed) === String(expectedHash).trim().toLowerCase();
  }

  return {
    POSITIONS: POSITIONS, DIFFICULTIES: DIFFICULTIES,
    sha256Hex: sha256Hex, hmacSha256Hex: hmacSha256Hex,
    bytes: bytes, floats: floats, shuffle: shuffle, popResult: popResult,
    choose: choose, survival: survival, table: table, verifySeedHash: verifySeedHash
  };
});
