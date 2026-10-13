import { cachedRead, clearReadCache } from './readCache';
import { bumpDataVersion, trackDataVersion } from './dataVersion';

beforeEach(() => {
  clearReadCache();
  trackDataVersion();
  jest.useFakeTimers().setSystemTime(new Date('2026-10-13T10:00:00Z'));
});
afterEach(() => jest.useRealTimers());

it('shares concurrent reads and invalidates after a database write', async () => {
  const read = jest.fn(async () => 7);
  const first = cachedRead('totals', read);
  expect(cachedRead('totals', read)).toBe(first);
  await first;
  bumpDataVersion();
  await cachedRead('totals', read);
  expect(read).toHaveBeenCalledTimes(2);
});

it.each([61_000, -1_000])('reloads when clock age is %i ms', async (shift) => {
  const read = jest.fn(async () => 7);
  await cachedRead('totals', read);
  jest.setSystemTime(Date.now() + shift);
  await cachedRead('totals', read);
  expect(read).toHaveBeenCalledTimes(2);
});

it('does not reuse a failed read', async () => {
  const read = jest.fn().mockRejectedValueOnce(new Error('busy')).mockResolvedValueOnce(7);
  await expect(cachedRead('totals', read)).rejects.toThrow('busy');
  await expect(cachedRead('totals', read)).resolves.toBe(7);
  expect(read).toHaveBeenCalledTimes(2);
});
