/** Which milestone notes have been shown, on real SQLite: each key is remembered once and the list stays bounded. */
import { createRealDataTestDb } from '@/test-support/realDataTestDb';

const mockTestDb = createRealDataTestDb();
jest.mock('@/db/client', () => ({
  getDb: async () => mockTestDb,
}));

import { CREATE_TABLES_SQL } from '@/db/schema';
import { getMilestonesSeen, markMilestonesSeen, resetSettingsCache } from '@/db/settings';

beforeAll(async () => {
  await mockTestDb.execAsync(CREATE_TABLES_SQL);
});

beforeEach(async () => {
  await mockTestDb.runAsync("DELETE FROM settings WHERE key = 'milestones_seen'");
  resetSettingsCache();
});

describe('seen milestones', () => {
  it('remembers each key once', async () => {
    expect(await getMilestonesSeen()).toEqual([]);
    await markMilestonesSeen(['goal:a:25']);
    await markMilestonesSeen(['goal:a:50', 'goal:a:25']);
    expect(await getMilestonesSeen()).toEqual(['goal:a:50', 'goal:a:25']);
  });

  it('survives a fresh read from the database', async () => {
    await markMilestonesSeen(['budgets:2026-09']);
    resetSettingsCache();
    expect(await getMilestonesSeen()).toEqual(['budgets:2026-09']);
  });

  it('keeps only the latest 200', async () => {
    await markMilestonesSeen(Array.from({ length: 210 }, (_, i) => `goal:g:${i}`));
    const seen = await getMilestonesSeen();
    expect(seen).toHaveLength(200);
    expect(seen[0]).toBe('goal:g:10');
  });

  it('shrugs off a damaged list', async () => {
    await mockTestDb.runAsync("INSERT INTO settings (key, value) VALUES ('milestones_seen', 'not json')");
    expect(await getMilestonesSeen()).toEqual([]);
    await markMilestonesSeen(['goal:a:25']);
    expect(await getMilestonesSeen()).toEqual(['goal:a:25']);
  });
});
