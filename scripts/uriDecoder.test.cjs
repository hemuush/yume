const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const decode = require('decode-uri-component');
const query = require('query-string');
test('router query parsing retains unicode, plus signs and repeated parameters', () => {
  assert.equal(typeof decode, 'function');
  assert.equal(decode('%E2%82%B9'), '₹');
  assert.deepEqual(
    { ...query.parse('note=Food+%26+Dining&name=%E0%A4%B9%E0%A5%87%E0%A4%AE%E0%A5%82&month=-1&tag=a&tag=b') },
    { note: 'Food & Dining', name: 'हेमू', month: '-1', tag: ['a', 'b'] }
  );
});
test('malformed URI decoding finishes within an isolated process deadline', () => {
  const child = spawnSync(
    process.execPath,
    [
      '-e',
      "const q=require('query-string'); const value='%E0%A4'.repeat(4096); const parsed=q.parse('note='+value); if(typeof parsed.note!=='string') process.exit(1);",
    ],
    { timeout: 3000, encoding: 'utf8' }
  );
  assert.equal(child.error, undefined);
  assert.equal(child.status, 0, child.stderr);
});
test('Xcode configuration UUIDs still use the expected 24-character format', () => {
  const project = require('xcode').project('unused.pbxproj');
  project.hash = { project: { objects: {} } };
  assert.match(project.generateUuid(), /^[A-F0-9]{24}$/);
});

test('vendored decoder matches the upstream security fix apart from its CommonJS export', () => {
  const crypto = require('node:crypto');
  const fs = require('node:fs');
  const path = require('node:path');
  const source =
    fs
      .readFileSync(path.join(__dirname, '../vendor/decode-uri-component/index.js'), 'utf8')
      .replace(/\r\n/g, '\n')
      .replace(
        'module.exports = function decodeUriComponent(encodedURI)',
        'export default function decodeUriComponent(encodedURI)'
      )
      .trimEnd() + '\n';
  assert.equal(
    crypto.createHash('sha256').update(source).digest('hex'),
    '9401353df38f8010ad7035fe8d666bce6a4902bc1cff809afc4ab23fa2e0bdaa'
  );
});
