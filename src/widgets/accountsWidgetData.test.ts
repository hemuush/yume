/**
 * The Accounts home-screen widget follows the same rules as Home's own
 * account chips: each balance in its account's own currency, and a savings
 * balance masked while "hide savings & investment amounts" is on.
 */
import { createRealDataTestDb } from '@/test-support/realDataTestDb';

const mockTestDb = createRealDataTestDb();
jest.mock('@/db/client', () => ({
  getDb: async () => mockTestDb,
}));
jest.mock('@/lib/notifications', () => ({ notifyOverspend: async () => {} }));

import { CREATE_TABLES_SQL } from '@/db/schema';
import { createAccount } from '@/db/ledger';
import { setDefaultCurrency, setHideSensitiveAmounts } from '@/db/settings';
import { formatMoney, getCurrencySymbol } from '@/lib/money';
import { getAccountsWidgetData } from './data';

describe('getAccountsWidgetData', () => {
  beforeAll(async () => {
    await mockTestDb.execAsync(CREATE_TABLES_SQL);
    await setDefaultCurrency('INR');
    await createAccount({ name: 'Everyday', type: 'bank', currency: 'INR', openingBalanceMinor: 1234500 });
    await createAccount({
      name: 'Rainy Day',
      type: 'savings',
      currency: 'INR',
      openingBalanceMinor: 5000000,
    });
    await createAccount({ name: 'Travel USD', type: 'bank', currency: 'USD', openingBalanceMinor: 25000 });
  });

  it("shows every balance in full, in the account's own currency, while hiding is off", async () => {
    await setHideSensitiveAmounts(false);
    const { accounts } = await getAccountsWidgetData();
    expect(accounts.map((a) => [a.name, a.balanceText])).toEqual([
      ['Everyday', formatMoney(1234500, 'INR')],
      ['Rainy Day', formatMoney(5000000, 'INR')],
      ['Travel USD', formatMoney(25000, 'USD')],
    ]);
  });

  it('masks only the savings balance while hiding is on, exactly like the in-app chip', async () => {
    await setHideSensitiveAmounts(true);
    const { accounts } = await getAccountsWidgetData();
    expect(accounts.find((a) => a.name === 'Rainy Day')!.balanceText).toBe(`${getCurrencySymbol('INR')}••••`);
    expect(accounts.find((a) => a.name === 'Everyday')!.balanceText).toBe(formatMoney(1234500, 'INR'));
    expect(accounts.find((a) => a.name === 'Travel USD')!.balanceText).toBe(formatMoney(25000, 'USD'));
  });
});
