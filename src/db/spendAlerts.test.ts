import { createRealDataTestDb } from '@/test-support/realDataTestDb';
let mockDb = createRealDataTestDb();
jest.mock('./client', () => ({ getDb: async () => mockDb }));
jest.mock('@/lib/notifications', () => ({ rebuildNotifications: jest.fn(async () => true) }));

import { CREATE_TABLES_SQL } from './schema';
import { queueSpendAlerts } from './spendAlerts';
import { getAlertQueue, getSpendSpikesSent, addSpendSpikeSent, resetSettingsCache } from './settings';

beforeEach(async () => {
  jest.useFakeTimers();
  jest.setSystemTime(new Date(2026, 9, 24, 12));
  mockDb = createRealDataTestDb();
  resetSettingsCache();
  await mockDb.execAsync(CREATE_TABLES_SQL);
  await mockDb.runAsync("INSERT INTO accounts (id,name,type,currency) VALUES ('bank','Bank','bank','INR')");
  await mockDb.runAsync(
    "INSERT INTO categories (id,name,kind) VALUES ('food','Food','expense'),('travel','Travel','expense')"
  );
  for (const [id, category, amount, date] of [
    ['food-before', 'food', 10000, '2026-09-01'],
    ['food-now', 'food', 20000, '2026-10-01'],
    ['travel-before', 'travel', 10000, '2026-09-01'],
    ['travel-now', 'travel', 10000, '2026-10-01'],
  ])
    await mockDb.runAsync(
      "INSERT INTO transactions (id,type,account_id,category_id,amount_minor,date) VALUES (?,'expense','bank',?,?,?)",
      [id, category, amount, date]
    );
});
afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

it('queues each category spike once per month even when the top-growing category switches back', async () => {
  await queueSpendAlerts('food');
  const originalFood = (await getAlertQueue()).find((alert) => alert.id === 'spike:food:2026-10');
  expect(originalFood).toBeDefined();
  await mockDb.runAsync("UPDATE transactions SET amount_minor=50000 WHERE id='travel-now'");
  await queueSpendAlerts('travel');
  await mockDb.runAsync("UPDATE transactions SET amount_minor=100000 WHERE id='food-now'");
  await queueSpendAlerts('food');
  expect((await getAlertQueue()).find((alert) => alert.id === originalFood!.id)).toEqual(originalFood);
  expect(await getSpendSpikesSent()).toEqual(['food:2026-10', 'travel:2026-10']);
});

it('retains the legacy plain-text key when adding another category and expires old months', async () => {
  await mockDb.runAsync("INSERT INTO settings (key,value) VALUES ('last_overspend_notified','food:2026-10')");
  expect(await getSpendSpikesSent()).toEqual(['food:2026-10']);
  await addSpendSpikeSent('travel:2026-10');
  await addSpendSpikeSent('old:2026-01');
  resetSettingsCache();
  expect(await getSpendSpikesSent()).toEqual(['food:2026-10', 'travel:2026-10']);
});

it('does not consume a spike if writing the alert queue fails', async () => {
  const write = jest.spyOn(mockDb, 'runAsync').mockImplementationOnce(async () => {
    throw new Error('Queue write failed');
  });
  await expect(queueSpendAlerts('food')).rejects.toThrow('Queue write failed');
  expect(await getSpendSpikesSent()).toEqual([]);
  write.mockRestore();
  await queueSpendAlerts('food');
  expect(await getSpendSpikesSent()).toEqual(['food:2026-10']);
  expect(await getAlertQueue()).toHaveLength(1);
});
