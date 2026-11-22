import { createRealDataTestDb } from '@/test-support/realDataTestDb';
let mockDb = createRealDataTestDb();
jest.mock('./client', () => ({ getDb: async () => mockDb }));
jest.mock('@/lib/notifications', () => ({ rebuildNotifications: async () => {} }));
jest.mock('./spendAlerts', () => ({ queueSpendAlerts: jest.fn(async () => {}) }));

import { CREATE_TABLES_SQL } from './schema';
import { createAccount, createCategory } from './ledger';
import { createPerson, recordMoneyGivenToPerson } from './people';
import { queueSpendAlerts } from './spendAlerts';
import { toLocalIsoDate } from '@/lib/date';

it('queues spend alerts for money given this month, not for a backdated entry', async () => {
  mockDb = createRealDataTestDb();
  await mockDb.execAsync(CREATE_TABLES_SQL);
  const accountId = (await createAccount({ name: 'Bank', type: 'bank' })).id;
  const categoryId = (await createCategory({ name: 'Food', kind: 'expense' })).id;
  const personId = (await createPerson({ name: 'Asha' })).id;
  const base = { personId, accountId, categoryId, amountMinor: 100 };
  await recordMoneyGivenToPerson({ ...base, date: '2020-01-05' });
  expect(queueSpendAlerts).not.toHaveBeenCalled();
  await recordMoneyGivenToPerson({ ...base, date: toLocalIsoDate(new Date()) });
  expect(queueSpendAlerts).toHaveBeenCalledWith(categoryId);
});
