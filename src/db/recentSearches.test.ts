/** Activity's recent searches: newest first, once each (ignoring case), only the last few. */
import { createRealDataTestDb } from '@/test-support/realDataTestDb';

const mockTestDb = createRealDataTestDb();
jest.mock('@/db/client', () => ({ getDb: async () => mockTestDb }));

import { CREATE_TABLES_SQL } from '@/db/schema';
import { getRecentSearches, setRecentSearches, RECENT_SEARCHES_KEPT } from '@/db/settings';

beforeAll(async () => {
  await mockTestDb.execAsync(CREATE_TABLES_SQL);
});

it('starts empty', async () => {
  expect(await getRecentSearches()).toEqual([]);
});

it('keeps each search once, newest first, and only the last few', async () => {
  await setRecentSearches(['Swiggy', 'swiggy ', 'rent', 'a', 'b', 'c', 'd', 'e']);
  const kept = await getRecentSearches();
  expect(kept[0]).toBe('Swiggy');
  expect(kept.filter((q) => q.toLowerCase() === 'swiggy')).toHaveLength(1);
  expect(kept).toHaveLength(RECENT_SEARCHES_KEPT);
});

it('clears', async () => {
  await setRecentSearches([]);
  expect(await getRecentSearches()).toEqual([]);
});
