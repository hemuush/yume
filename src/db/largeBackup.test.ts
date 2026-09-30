/**
 * A long-time user's database: 50,000 transactions must survive a backup →
 * JSON → restore round trip intact, in a reasonable time and size. The
 * snapshot holds the whole database in memory, so this pins how big that gets.
 */
import { createRealDataTestDb } from '@/test-support/realDataTestDb';

const mockTestDb = createRealDataTestDb();
jest.mock('@/db/client', () => ({
  getDb: async () => mockTestDb,
}));

import { CREATE_TABLES_SQL } from '@/db/schema';
import { buildBackupSnapshot, restoreFromSnapshot } from '@/lib/backup';

const ROWS = 50_000;

describe('backup of a large database', () => {
  beforeAll(async () => {
    await mockTestDb.execAsync(CREATE_TABLES_SQL);
    await mockTestDb.execAsync(`
      INSERT INTO accounts (id, name, type) VALUES ('a1', 'Bank', 'bank');
      INSERT INTO categories (id, name, kind) VALUES ('c1', 'Food', 'expense');
      WITH RECURSIVE n(i) AS (SELECT 1 UNION ALL SELECT i + 1 FROM n WHERE i < ${ROWS})
      INSERT INTO transactions (id, type, account_id, category_id, amount_minor, date, note)
      SELECT 'tx-' || i, 'expense', 'a1', 'c1', 100 + (i % 9000),
             date('2020-01-01', '+' || (i % 2000) || ' days'),
             'Weekly vegetables and milk from the market #' || i
      FROM n;
    `);
  }, 60_000);

  it('round-trips every row through JSON', async () => {
    const snapshot = await buildBackupSnapshot();
    expect(snapshot.tables.transactions).toHaveLength(ROWS);

    const json = JSON.stringify(snapshot);
    const sizeMb = json.length / 1024 / 1024;
    // ~100 bytes a row once serialised; flag a schema change that bloats it.
    expect(sizeMb).toBeLessThan(40);

    await mockTestDb.execAsync('DELETE FROM transactions');
    await restoreFromSnapshot(JSON.parse(json));

    const restored = await mockTestDb.getFirstAsync<{ n: number; total: number }>(
      'SELECT COUNT(*) AS n, SUM(amount_minor) AS total FROM transactions'
    );
    const expectedTotal = snapshot.tables.transactions.reduce((sum, r) => sum + Number(r.amount_minor), 0);
    expect(restored).toEqual({ n: ROWS, total: expectedTotal });
  }, 120_000);
});
