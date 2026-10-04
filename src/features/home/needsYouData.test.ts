/**
 * Shared Needs you loader on a real SQLite engine: finds a budget over its limit and repeated entries (Tidy
 * up), and ✕ hides an item until it's shown again.
 */
import { createRealDataTestDb } from '@/test-support/realDataTestDb';

const mockTestDb = createRealDataTestDb();
jest.mock('@/db/client', () => ({
  getDb: async () => mockTestDb,
}));
jest.mock('@/lib/notifications', () => ({ rebuildNotifications: async () => {} }));

import { CREATE_TABLES_SQL } from '@/db/schema';
import { createAccount, createCategory, createTransaction, listAccounts } from '@/db/ledger';
import { createBudget } from '@/db/budgets';
import {
  setLocalBackupFolderUri,
  resetSettingsCache,
  getHiddenSubscriptionSuggestions,
  hideSubscriptionSuggestion,
  getNeedsYouDismissed,
  setNeedsYouDismissed,
  getBackupNudgeSnoozedUntil,
} from '@/db/settings';
import * as budgetsDb from '@/db/budgets';
import { toLocalIsoDate, addMonthsToIsoDate } from '@/lib/date';
import { loadNeedsYou, dismissNeedsYou, restoreNeedsYou, snoozeBackupReminder } from './needsYouData';

beforeAll(async () => {
  await mockTestDb.execAsync(CREATE_TABLES_SQL);
  resetSettingsCache();
  await setLocalBackupFolderUri('content://backups'); // a backup is set up, so no backup nudge
  const bank = (await createAccount({ name: 'Bank', type: 'bank', currency: 'INR', openingBalanceMinor: 0 }))
    .id;
  const food = (await createCategory({ name: 'Food', kind: 'expense' })).id;
  await createBudget({ categoryId: food, limitAmountMinor: 10000, rollover: false });
  const today = toLocalIsoDate(new Date());
  for (let i = 0; i < 2; i++) {
    await createTransaction({
      type: 'expense',
      accountId: bank,
      categoryId: food,
      amountMinor: 8000,
      date: today,
    });
  }
});

it('lists a budget over its limit and what Tidy up found', async () => {
  const { shown, dismissed } = await loadNeedsYou();
  expect(shown.map((i) => [i.title, i.detail])).toEqual([
    ['Food budget', 'Over its limit'],
    ['Tidy up', '1 thing to check'],
  ]);
  expect(dismissed).toEqual([]);
});

it('hides a dismissed item until it is shown again', async () => {
  const [budget] = (await loadNeedsYou()).shown;
  await dismissNeedsYou(budget.key);
  let result = await loadNeedsYou();
  expect(result.shown.map((i) => i.title)).toEqual(['Tidy up']);
  expect(result.dismissed.map((i) => i.title)).toEqual(['Food budget']);

  await restoreNeedsYou(budget.key);
  result = await loadNeedsYou();
  expect(result.shown.map((i) => i.title)).toEqual(['Food budget', 'Tidy up']);
});

it('treats a "looks monthly" charge as one thing with Recurring: hidden and brought back together', async () => {
  const [bank] = await listAccounts();
  const wifi = (await createCategory({ name: 'Wifi', kind: 'expense' })).id;
  const today = toLocalIsoDate(new Date());
  for (const back of [0, -1, -2]) {
    await createTransaction({
      type: 'expense',
      accountId: bank.id,
      categoryId: wifi,
      amountMinor: 64900,
      date: addMonthsToIsoDate(today, back),
    });
  }
  const monthly = (await loadNeedsYou()).shown.find((i) => i.title === 'Wifi looks monthly')!;
  expect(monthly.action).toBe('recurring');

  // ✕ in Needs you hides it on Recurring as well…
  await dismissNeedsYou(monthly.key);
  expect(await getHiddenSubscriptionSuggestions()).toEqual([`sub-${wifi}`]);
  let result = await loadNeedsYou();
  expect(result.shown.map((i) => i.title)).not.toContain('Wifi looks monthly');
  expect(result.dismissed.map((i) => i.title)).toContain('Wifi looks monthly');

  // …bringing it back shows it in both again…
  await restoreNeedsYou(monthly.key);
  expect(await getHiddenSubscriptionSuggestions()).toEqual([]);
  expect((await loadNeedsYou()).shown.map((i) => i.title)).toContain('Wifi looks monthly');

  // …and hiding it on Recurring moves it to Needs you's dismissed list.
  await hideSubscriptionSuggestion(`sub-${wifi}`);
  result = await loadNeedsYou();
  expect(result.dismissed.map((i) => i.title)).toContain('Wifi looks monthly');
});

describe('when one source fails', () => {
  afterEach(() => jest.restoreAllMocks());

  it('drops only that source instead of blanking the list', async () => {
    jest.spyOn(budgetsDb, 'listBudgetsForMonth').mockRejectedValue(new Error('budgets unavailable'));
    const { shown } = await loadNeedsYou();
    expect(shown.map((i) => i.title)).toContain('Tidy up');
    expect(shown.map((i) => i.title)).not.toContain('Food budget');
  });

  it('keeps stored dismissals, since the picture is incomplete', async () => {
    await setNeedsYouDismissed(['stale-key']);
    jest.spyOn(budgetsDb, 'listBudgetsForMonth').mockRejectedValue(new Error('budgets unavailable'));
    await loadNeedsYou();
    expect(await getNeedsYouDismissed()).toEqual(['stale-key']);
    await setNeedsYouDismissed([]);
  });
});

it('prunes dismissals whose item is gone, and keeps the ones still showing', async () => {
  const [budget] = (await loadNeedsYou()).shown;
  await setNeedsYouDismissed(['stale-key', budget.key]);
  const { dismissed } = await loadNeedsYou();
  // (A hidden subscription suggestion from the test above also lists here; it isn't a stored key.)
  expect(dismissed.map((i) => i.key)).toContain(budget.key);
  expect(await getNeedsYouDismissed()).toEqual([budget.key]);
  await restoreNeedsYou(budget.key);
});

it('snoozes the backup reminder from the time it is given, not the clock', async () => {
  await snoozeBackupReminder(new Date('2026-01-01T00:00:00.000Z'));
  expect(await getBackupNudgeSnoozedUntil()).toBe('2026-01-31T00:00:00.000Z');
});
