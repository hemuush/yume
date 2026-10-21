const test = require('node:test');
const assert = require('node:assert/strict');

// Expo Router 58 parses deep-link queries with the platform's own URL/URI decoding. Its behavior is covered in
// src/lib/deepLinkParams.test.ts. This guards the old risk: the userland query-string/decode-uri-component chain
// (a ReDoS fixed only in an ESM-only release) must not return through a dependency.
for (const name of ['query-string', 'decode-uri-component']) {
  test(`${name} is not part of the installed dependency tree`, () => {
    assert.throws(() => require.resolve(name), { code: 'MODULE_NOT_FOUND' });
  });
}

test('Xcode configuration UUIDs still use the expected 24-character format', () => {
  const project = require('xcode').project('unused.pbxproj');
  project.hash = { project: { objects: {} } };
  assert.match(project.generateUuid(), /^[A-F0-9]{24}$/);
});
