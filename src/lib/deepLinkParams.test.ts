import path from 'node:path';

// Expo Router's own deep-link parser (not public API, hence the file path). It replaced the query-string library
// in SDK 58; these checks keep the guarantees the old decoder test gave: nothing is mangled and nothing stalls.
const routerDir = path.dirname(require.resolve('expo-router/package.json'));
const { getStateFromPath } = require(path.join(routerDir, 'build/fork/getStateFromPath')) as {
  getStateFromPath: (
    link: string,
    config: unknown
  ) => { routes: { params?: Record<string, string | string[]> }[] } | undefined;
};
const config = { screens: { 'add-transaction': 'add-transaction' } };
const paramsOf = (link: string) => getStateFromPath(link, config)?.routes[0]?.params;

it('keeps unicode, plus signs, signed numbers and repeated parameters', () => {
  expect(
    paramsOf(
      '/add-transaction?note=Food+%26+Dining&name=%E0%A4%B9%E0%A5%87%E0%A4%AE%E0%A5%82&month=-1&tag=a&tag=b'
    )
  ).toEqual({ note: 'Food & Dining', name: 'हेमू', month: '-1', tag: ['a', 'b'] });
});

it('handles a long malformed percent-encoded value quickly and without throwing', () => {
  const started = Date.now();
  const params = paramsOf('/add-transaction?note=' + '%E0%A4'.repeat(4096));
  expect(typeof params?.note).toBe('string');
  expect(Date.now() - started).toBeLessThan(1000);
});
