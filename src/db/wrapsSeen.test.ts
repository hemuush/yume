/**
 * Which Wraps have been played, on real SQLite: the Wrap button's ring goes plain for these; only the latest
 * few are kept, and a month played via Home's old review row still counts.
 */
import { createRealDataTestDb } from '@/test-support/realDataTestDb';

const mockTestDb = createRealDataTestDb();
jest.mock('@/db/client', () => ({
  getDb: async () => mockTestDb,
}));

import { CREATE_TABLES_SQL } from '@/db/schema';
import { getSeenWraps, markWrapSeen } from '@/db/settings';

beforeAll(async () => {
  await mockTestDb.execAsync(CREATE_TABLES_SQL);
});

beforeEach(async () => {
  await mockTestDb.runAsync("DELETE FROM settings WHERE key IN ('wraps_seen', 'month_review_dismissed')");
});

describe('seen Wraps', () => {
  it('remembers a month and a week once each', async () => {
    expect(await getSeenWraps()).toEqual([]);
    await markWrapSeen('2026-09');
    await markWrapSeen('2026-09-27');
    await markWrapSeen('2026-09');
    expect(await getSeenWraps()).toEqual(['2026-09', '2026-09-27']);
  });

  it('keeps only the latest twelve', async () => {
    for (let i = 1; i <= 14; i++) await markWrapSeen(`2025-${String(i).padStart(2, '0')}`);
    const seen = await getSeenWraps();
    expect(seen).toHaveLength(12);
    expect(seen[0]).toBe('2025-03');
  });

  it("counts a month already played from Home's old review row", async () => {
    await mockTestDb.runAsync(
      "INSERT INTO settings (key, value) VALUES ('month_review_dismissed', '2026-09')"
    );
    expect(await getSeenWraps()).toContain('2026-09');
  });

  it('shrugs off a damaged list', async () => {
    await mockTestDb.runAsync("INSERT INTO settings (key, value) VALUES ('wraps_seen', 'not json')");
    expect(await getSeenWraps()).toEqual([]);
    await markWrapSeen('2026-09');
    expect(await getSeenWraps()).toEqual(['2026-09']);
  });
});
