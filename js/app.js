(function () {
  'use strict';
  var P = window.PumpFair, KEY = 'pumplab.v1';
  var HEX64 = /^[0-9a-f]{64}$/i;
  var state = load();
  var difficulty = state.difficulty;

  function blank() {
    return { difficulty: 'easy', nonce: 0, pairId: 1,
      active: { client: '', hash: '' }, next: { client: '', hash: '' }, rotations: [], history: [] };
  }
  function load() {
    var s = blank();
    try {
      var raw = JSON.parse(localStorage.getItem(KEY));
      if (raw && typeof raw === 'object') for (var k in s) if (raw[k] !== undefined) s[k] = raw[k];
    } catch (e) { /* storage unavailable or corrupt: use defaults */ }
    if (!P.DIFFICULTIES[s.difficulty]) s.difficulty = 'easy';
    return s;
  }
  function save() {
    state.difficulty = difficulty;
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* private mode */ }
  }
  function $(id) { return document.getElementById(id); }
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; }
  function pct(x) { return (x * 100).toFixed(2) + '%'; }
  function say(node, text, ok) { node.textContent = text; node.className = 'msg ' + (ok ? 'ok' : 'bad'); }
  function short(h) { return h ? h.slice(0, 8) + '…' : '—'; }

  // Navigation
  var tabs = document.querySelectorAll('.tabs button');
  Array.prototype.forEach.call(tabs, function (b) {
    b.addEventListener('click', function () {
      Array.prototype.forEach.call(tabs, function (x) { x.classList.toggle('active', x === b); });
      Array.prototype.forEach.call(document.querySelectorAll('[data-panel]'), function (p) { p.hidden = p.id !== 'tab-' + b.dataset.tab; });
      window.scrollTo(0, 0);
    });
  });

  // Difficulty widgets
  ['vDiff', 'logDiff'].forEach(function (id) {
    Object.keys(P.DIFFICULTIES).forEach(function (k) {
      var o = el('option', null, P.DIFFICULTIES[k].label + ' (' + P.DIFFICULTIES[k].pops + ' pop' + (P.DIFFICULTIES[k].pops > 1 ? 's' : '') + ')');
      o.value = k; $(id).appendChild(o);
    });
    $(id).value = difficulty;
  });
  Object.keys(P.DIFFICULTIES).forEach(function (k) {
    var b = el('button', null, P.DIFFICULTIES[k].label); b.type = 'button'; b.dataset.d = k;
    b.addEventListener('click', function () { difficulty = k; $('vDiff').value = k; $('logDiff').value = k; save(); renderCalc(); });
    $('diffSeg').appendChild(b);
  });

  // Seeds
  function renderSeeds() {
    $('activeClient').value = state.active.client; $('activeHash').value = state.active.hash;
    $('nextClient').value = state.next.client; $('nextHash').value = state.next.hash;
    var log = $('rotationLog'); log.textContent = '';
    if (!state.rotations.length) log.appendChild(el('li', null, 'No rotations yet.'));
    state.rotations.slice().reverse().forEach(function (r) {
      log.appendChild(el('li', null, new Date(r.at).toLocaleString() + ' — pair #' + r.pairId + ' retired (client "' + r.client + '", hash ' + short(r.hash) + ', last nonce ' + r.lastNonce + ')'));
    });
  }
  function validHash(h) { return h === '' || HEX64.test(h); }
  $('seedForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var a = $('activeHash').value.trim(), n = $('nextHash').value.trim();
    if (!validHash(a) || !validHash(n)) return say($('seedMsg'), 'Hashes must be 64 hex characters.', false);
    state.active = { client: $('activeClient').value.trim(), hash: a.toLowerCase() };
    state.next = { client: $('nextClient').value.trim(), hash: n.toLowerCase() };
    save(); renderSeeds(); say($('seedMsg'), 'Saved on this device.', true);
  });
  $('rotateBtn').addEventListener('click', function () {
    if (!state.next.client && !state.next.hash) return say($('seedMsg'), 'Enter the next client seed / hash first.', false);
    state.rotations.push({ pairId: state.pairId, client: state.active.client, hash: state.active.hash, lastNonce: state.nonce, at: Date.now() });
    state.active = state.next; state.next = { client: '', hash: '' };
    state.pairId += 1; state.nonce = 0;
    save(); renderSeeds(); renderNonce(); renderHistory();
    say($('seedMsg'), 'Rotated. Pair #' + state.pairId + ' is active, nonce reset to 0. Enter the next pair when known.', true);
  });

  // Calculator
  function renderCalc() {
    Array.prototype.forEach.call($('diffSeg').children, function (b) { b.classList.toggle('active', b.dataset.d === difficulty); });
    var d = P.DIFFICULTIES[difficulty], t = P.table(difficulty);
    $('diffInfo').textContent = d.pops + ' pop' + (d.pops > 1 ? 's' : '') + ' hidden among 25 positions. Max safe pumps: ' + (25 - d.pops) + '.';
    var n = Math.max(1, Math.min(25, parseInt($('pumpCount').value, 10) || 1)), r = t[n - 1];
    var box = $('calcResult'); box.textContent = '';
    [['Survive ' + n + ' pump' + (n > 1 ? 's' : ''), pct(r.survive)], ['Cumulative pop risk', pct(r.cumulativePop)],
     ['Pop exactly at pump ' + n, pct(r.popAtThisPump)], ['Risk of pump ' + n + ' (if reached)', pct(r.conditionalRisk)]].forEach(function (c) {
      var card = el('div', 'card'); card.appendChild(el('b', null, c[1])); card.appendChild(el('span', null, c[0])); box.appendChild(card);
    });
    var grid = $('grid'); grid.textContent = '';
    t.forEach(function (row) {
      var b = el('button', 'cell' + (row.pump <= n ? ' in' : ''), row.pump + '\n' + pct(row.cumulativePop)); b.type = 'button';
      b.style.whiteSpace = 'pre-line';
      b.addEventListener('click', function () { $('pumpCount').value = row.pump; renderCalc(); });
      grid.appendChild(b);
    });
    var tb = $('probTable').tBodies[0]; tb.textContent = '';
    t.forEach(function (row) {
      var tr = el('tr', row.reachable ? '' : 'dead');
      [row.pump, pct(row.conditionalRisk), pct(row.popAtThisPump), pct(row.cumulativePop), pct(row.survive)].forEach(function (v) { tr.appendChild(el('td', null, String(v))); });
      tb.appendChild(tr);
    });
  }
  $('pumpCount').addEventListener('input', renderCalc);

  // Verification
  function verify(server, hash, client, nonce, diff, observed) {
    var out = { hashOk: null, result: P.popResult(server, client, nonce, diff) };
    if (hash) out.hashOk = P.verifySeedHash(server, hash);
    if (observed) out.matches = out.result.popPump === observed;
    return out;
  }
  $('useActive').addEventListener('click', function () {
    $('vClient').value = state.active.client; $('vHash').value = state.active.hash; $('vNonce').value = state.nonce;
  });
  $('verifyForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var box = $('verifyResult'); box.textContent = '';
    var nonce = parseInt($('vNonce').value, 10), obs = parseInt($('vObserved').value, 10) || 0;
    var hash = $('vHash').value.trim();
    if (!(nonce >= 0)) return;
    var v = verify($('vServer').value.trim(), hash, $('vClient').value.trim(), nonce, $('vDiff').value, obs);
    var cards = [['Computed pop pump', String(v.result.popPump)], ['All pop positions', v.result.popPoints.join(', ')]];
    cards.push(['Seed hash check', v.hashOk === null ? 'No hash given' : v.hashOk ? '✓ matches' : '✗ MISMATCH']);
    if (obs) cards.push(['Observed vs computed', v.matches ? '✓ match' : '✗ differ']);
    cards.forEach(function (c) { var card = el('div', 'card'); card.appendChild(el('b', null, c[1])); card.appendChild(el('span', null, c[0])); box.appendChild(card); });
    if (v.hashOk !== false) {
      state.history.push({ pairId: state.pairId, nonce: nonce, difficulty: $('vDiff').value, seen: obs || null,
        computed: v.result.popPump, verified: obs ? v.matches : null, at: Date.now() });
      save(); renderHistory();
    }
  });

  // Nonce & history
  function renderNonce() { $('nonceInput').value = state.nonce; }
  function renderHistory() {
    var tb = $('histTable').tBodies[0]; tb.textContent = '';
    state.history.forEach(function (h, i) {
      var tr = el('tr');
      [i + 1, '#' + h.pairId, h.nonce, P.DIFFICULTIES[h.difficulty].label, h.seen || h.computed || '—',
       h.verified === true ? '✓' : h.verified === false ? '✗' : '—'].forEach(function (v) { tr.appendChild(el('td', null, String(v))); });
      tb.appendChild(tr);
    });
  }
  $('nonceInput').addEventListener('change', function () { state.nonce = Math.max(0, parseInt(this.value, 10) || 0); save(); renderNonce(); });
  $('nonceInc').addEventListener('click', function () { state.nonce += 1; save(); renderNonce(); });
  $('nonceForm').addEventListener('submit', function (e) {
    e.preventDefault();
    state.nonce = Math.max(0, parseInt($('nonceInput').value, 10) || 0);
    var seen = parseInt($('logPump').value, 10) || null;
    state.history.push({ pairId: state.pairId, nonce: state.nonce, difficulty: $('logDiff').value, seen: seen, computed: null, verified: null, at: Date.now() });
    state.nonce += 1; $('logPump').value = '';
    save(); renderNonce(); renderHistory(); say($('histMsg'), 'Round logged.', true);
  });
  $('exportBtn').addEventListener('click', function () {
    var blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'pump-lab-export.json';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  });
  $('clearBtn').addEventListener('click', function () {
    if (!window.confirm('Delete all seeds, nonce and history from this device?')) return;
    try { localStorage.removeItem(KEY); } catch (e) { /* ignore */ }
    state = blank(); difficulty = state.difficulty;
    renderAll(); say($('histMsg'), 'All local data cleared.', true);
  });

  function renderAll() { renderSeeds(); renderCalc(); renderNonce(); renderHistory(); }
  renderAll();
})();
