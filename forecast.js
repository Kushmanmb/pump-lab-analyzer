'use strict';
// Next Play Forecast UI. Depends on pump-math.js (PumpForecast) and the seed inputs in index.html.
(function () {
  const M = window.PumpForecast;
  const g = id => document.getElementById(id);
  const LOG_KEY = 'pumpLabHistoryV1', RET_KEY = 'pumpLabRetiredV1', NONCE_KEY = 'pumpLabNonceV1';
  const HASH_RE = /^[0-9a-f]{64}$/i;
  const pct = p => { if (p === null) return 'N/A'; const n = 100 * p; return (n >= 1 || n === 0 ? n.toFixed(2) : n.toFixed(4)) + '%'; };
  const mult = v => v ? v.toFixed(2) + '×' : '—';

  const load = key => { try { const v = JSON.parse(localStorage.getItem(key)); return Array.isArray(v) ? v : []; } catch (e) { return []; } };
  const save = (key, v) => { try { localStorage.setItem(key, JSON.stringify(v)); } catch (e) { /* storage unavailable */ } };

  let metric = 'firstPop', selected = 1;

  function syncFromActive() {
    g('fcClient').value = g('activeClient').value;
    g('fcHash').value = g('activeHash').value;
    seedStatus();
  }
  function pushToActive(fcId, activeId) {
    g(activeId).value = g(fcId).value;
    g(activeId).dispatchEvent(new Event('change'));
    seedStatus();
  }
  function seedStatus() {
    const el = g('fcSeedStatus'), h = g('fcHash').value.trim(), n = g('fcNonce').value;
    const badNonce = n === '' || !Number.isSafeInteger(+n) || +n < 0;
    let msg = 'Server seed hidden: the next pop position is unknown and cannot be derived from the hash.', kind = '';
    if (h && !HASH_RE.test(h)) { msg = 'Server seed hash is not 64 hexadecimal characters.'; kind = 'warn'; }
    else if (badNonce) { msg = 'Nonce must be a non-negative integer.'; kind = 'bad'; }
    el.className = 'status ' + kind;
    el.textContent = msg;
  }

  function renderChart() {
    const name = g('fcDifficulty').value, { pops, max } = M.LEVELS[name];
    const rows = M.distribution(name);
    const vals = rows.map(r => r[metric] ?? 0);
    const top = Math.max(...vals) || 1;
    if (selected > 25) selected = 25;
    g('fcChart').innerHTML = rows.map((r, i) => {
      const off = !r.playable || vals[i] === 0;
      return `<button type="button" class="fc-bar${off ? ' off' : ''}" data-pos="${r.position}" aria-pressed="${r.position === selected}" aria-label="Position ${r.position}: ${pct(r[metric])}" style="height:${Math.max(2, 100 * vals[i] / top)}%"></button>`;
    }).join('');
    g('fcAxis').innerHTML = rows.map(r => `<span>${r.position}</span>`).join('');
    const r = rows[selected - 1];
    g('fcDetail').innerHTML = `<strong>Position ${r.position}</strong> · ${pops} pop${pops === 1 ? '' : 's'}, max ${max} pumps<br>First pop exactly here: ${pct(r.firstPop)} · Survive through here: ${pct(r.survive)} · Pop risk if alive on arrival: ${r.conditionalPop === null ? 'N/A (position unreachable)' : pct(r.conditionalPop)} · Payout: ${r.playable ? mult(r.payout) : 'not playable'}`;
    g('fcRows').innerHTML = rows.filter(r => r.playable).map(r => `<tr class="${r.position === selected ? 'selected' : ''}"><td>${r.position}</td><td>${pct(r.survive)}</td><td>${r.position < max ? pct(M.conditionalPop(r.position, pops)) : '—'}</td><td>${mult(r.payout)}</td></tr>`).join('');
    g('fcPumps').max = max;
  }

  function esc(s) { return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

  function renderLog() {
    const log = load(LOG_KEY), a = M.audit(log);
    g('fcLogRows').innerHTML = log.slice().reverse().slice(0, 50).map(e =>
      `<tr><td>${esc(new Date(e.time).toLocaleString())}</td><td>${esc(e.difficulty)}</td><td>${esc(e.nonce)}</td><td>${esc(e.pumps)}</td><td>${e.outcome === 'cashed' ? 'Cashed out' : e.outcome === 'popped' ? 'Popped on pump ' + esc(e.pumps) : 'Unknown'}</td><td>${esc(e.client)}</td></tr>`
    ).join('') || '<tr><td colspan="6">No results logged.</td></tr>';
    const summary = `${a.rounds} valid completed round${a.rounds === 1 ? '' : 's'}: ${a.cashed} cashed out, ${a.popped} popped.`;
    const skipped = a.invalid ? ` ${a.invalid} incomplete/invalid record(s) excluded.` : '';
    g('fcAudit').className = 'status';
    g('fcAudit').textContent = `${summary}${skipped} ${load(RET_KEY).length} retired pair(s) recorded. These counts do not predict future rounds; no statistical significance is inferred from stopping points.`;
  }

  function nonce() { const n = +g('fcNonce').value; return Number.isSafeInteger(n) && n >= 0 ? n : 0; }
  function setNonce(n) { g('fcNonce').value = n; try { localStorage.setItem(NONCE_KEY, String(n)); } catch (e) { /* ignore */ } seedStatus(); }

  g('fcChart').addEventListener('click', e => { const b = e.target.closest('.fc-bar'); if (b) { selected = +b.dataset.pos; renderChart(); } });
  document.querySelectorAll('.fc-seg button').forEach(b => b.addEventListener('click', () => {
    metric = b.dataset.metric;
    document.querySelectorAll('.fc-seg button').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
    renderChart();
  }));
  g('fcDifficulty').addEventListener('change', () => { g('difficulty').value = g('fcDifficulty').value; g('difficulty').dispatchEvent(new Event('change')); renderChart(); });
  g('fcClient').addEventListener('input', () => pushToActive('fcClient', 'activeClient'));
  g('fcHash').addEventListener('input', () => pushToActive('fcHash', 'activeHash'));
  g('fcNonce').addEventListener('input', () => setNonce(g('fcNonce').value === '' ? '' : +g('fcNonce').value));
  g('fcNonceUp').addEventListener('click', () => setNonce(nonce() + 1));
  g('fcNonceZero').addEventListener('click', () => setNonce(0));
  ['activeClient', 'activeHash'].forEach(id => g(id).addEventListener('change', syncFromActive));

  g('fcRotate').addEventListener('click', () => {
    const c = g('nextClient').value.trim(), h = g('nextHash').value.trim();
    if (!c || !HASH_RE.test(h)) {
      setStatus(g('fcSeedStatus'), 'Enter a next client seed and valid 64-character hash first.', 'warn');
      return;
    }
    const retired = load(RET_KEY);
    retired.push({ time: Date.now(), client: g('fcClient').value, hash: g('fcHash').value, lastNonce: nonce() });
    // Reuse the existing rotation handler so the old pair is copied to the
    // historical verifier and existing persisted settings remain compatible.
    g('rotate').click();
    save(RET_KEY, retired);
    setNonce(0);
    syncFromActive();
    renderLog();
  });

  g('fcLog').addEventListener('click', () => {
    const name = g('fcDifficulty').value, max = M.LEVELS[name].max;
    const pumps = Number(g('fcPumps').value), rawNonce = g('fcNonce').value;
    if (!Number.isInteger(pumps) || pumps < 1 || pumps > max) {
      setStatus(g('fcAudit'), `Pumps must be a whole number from 1 to ${max}.`, 'bad');
      return;
    }
    if (rawNonce === '' || !Number.isSafeInteger(+rawNonce) || +rawNonce < 0) {
      setStatus(g('fcAudit'), 'Enter a valid non-negative whole-number nonce before logging.', 'bad');
      return;
    }
    const log = load(LOG_KEY);
    log.push({ time: Date.now(), difficulty: name, nonce: +rawNonce,
      pumps, outcome: g('fcOutcome').value, client: g('fcClient').value,
      hash: g('fcHash').value.trim() });
    save(LOG_KEY, log);
    setNonce(+rawNonce + 1);
    renderLog();
  });
  g('fcClearLog').addEventListener('click', () => {
    if (!confirm('Delete the local audit log and retired pair records?')) return;
    save(LOG_KEY, []); save(RET_KEY, []); renderLog();
  });
  g('fcExport').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify({ results: load(LOG_KEY), retiredPairs: load(RET_KEY) }, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = 'pump-lab-audit.json'; a.click();
    URL.revokeObjectURL(a.href);
  });

  try { const n = localStorage.getItem(NONCE_KEY); if (n !== null && Number.isSafeInteger(+n) && +n >= 0) g('fcNonce').value = n; } catch (e) { /* ignore */ }
  g('fcDifficulty').value = g('difficulty').value;
  syncFromActive();
  renderChart();
  renderLog();
})();
