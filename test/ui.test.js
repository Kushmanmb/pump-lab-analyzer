'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const ids = new Set([...html.matchAll(/\sid="([^"]+)"/g)].map(m => m[1]));

test('element ids are unique', () => {
  const all = [...html.matchAll(/\sid="([^"]+)"/g)].map(m => m[1]);
  assert.equal(all.length, ids.size);
});

test('every id referenced by scripts exists in index.html', () => {
  const sources = [html, fs.readFileSync(path.join(root, 'forecast.js'), 'utf8')].join('\n');
  const refs = new Set([...sources.matchAll(/(?:\$|\bg|getElementById)\(\s*'([A-Za-z][\w-]*)'\s*\)/g)].map(m => m[1]));
  const missing = [...refs].filter(r => !ids.has(r));
  assert.deepEqual(missing, []);
});

test('every tab has a matching page and the forecast tab is present', () => {
  const tabs = [...html.matchAll(/data-tab="(\w+)"/g)].map(m => m[1]);
  for (const t of tabs) assert.ok(ids.has(t), `missing page for ${t}`);
  assert.ok(tabs.includes('forecast'));
});

test('scripts referenced by the page exist and the verifier is intact', () => {
  for (const m of html.matchAll(/<script src="([^"]+)"/g)) assert.ok(fs.existsSync(path.join(root, m[1])), m[1]);
  assert.match(html, /viewport/);
  assert.match(html, /id="verifyButton"/);
  assert.match(html, /cannot be determined/);
});

test('selects use 16px text to avoid iOS focus zoom, and narrow tabs are handled', () => {
  assert.match(html, /\.field select\{font-size:16px\}/);
  assert.match(html, /@media\(max-width:420px\)/);
  assert.match(html, /@media\(max-width:710px\)[^@]{0,200}\.two\{grid-template-columns:1fr/);
});

test('forecast log does not offer post-round target-based z-scores', () => {
  const forecast = fs.readFileSync(path.join(root, 'forecast.js'), 'utf8');
  assert.doesNotMatch(html, /id="fcTarget"/);
  assert.doesNotMatch(forecast, /\.z\b|\.expected\b/);
  assert.match(forecast, /cashed out/);
  assert.match(forecast, /popped/);
});
