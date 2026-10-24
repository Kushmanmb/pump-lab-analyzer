"use strict";
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const script = html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
assert.ok(script, 'inline verifier script exists');
const cut = script.indexOf('const $=');
assert.ok(cut > 0, 'math implementation found before UI handlers');
const math = vm.runInNewContext(script.slice(0, cut) + '\n({ hashText, pumpPermutation });', { TextEncoder });
const server = '2a282bd896c7a7cac6c635d3c055b4c0200fcb531e5b24d941ed51dfbc6ce5b7';
const hash = 'd5276a4f593fb26a856af73a4980f7ea34cfcfbbc4ea3980fbf3d85bfa59bc1b';
const client = 'Yncex39mfE';

test('historical SHA-256 commitment matches', () => {
  assert.equal(math.hashText(server), hash);
});
test('nonce 78 reproduces positions 8, 18, 20', () => {
  assert.deepEqual(Array.from(math.pumpPermutation(server, client, 78).slice(0, 3)).sort((a,b)=>a-b), [8,18,20]);
});
test('nonce 103 reproduces positions 23, 24, 25', () => {
  assert.deepEqual(Array.from(math.pumpPermutation(server, client, 103).slice(0, 3)).sort((a,b)=>a-b), [23,24,25]);
});
