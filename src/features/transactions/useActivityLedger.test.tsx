/** What Activity holds of the ledger for a period: loaded together, kept when nothing changed, newest load wins. */
import { act } from 'react-test-renderer';
import { renderHook } from '@/test-support/renderHook';
import type { Account, Category, Transaction } from '@/types';

const mockRows = jest.fn(async (..._args: unknown[]): Promise<Transaction[]> => []);
jest.mock('@/db/ledger', () => ({
  listTransactions: (...args: unknown[]) => mockRows(...args),
  listAccounts: async () => [{ id: 'bank', name: 'Bank', currency: 'INR' }] as Account[],
  listCategories: async () => [{ id: 'food', name: 'Food' }] as Category[],
}));
const mockTotals = jest.fn(async (..._args: unknown[]): Promise<unknown> => ({ period: 'week' }));
jest.mock('@/db/reports', () => ({ getRangeComparison: (...args: unknown[]) => mockTotals(...args) }));

import { useActivityLedger } from './useActivityLedger';

const week = { fromDate: '2026-09-20', toDate: '2026-09-26' };
const tea = {
  id: 'tea',
  type: 'expense',
  accountId: 'bank',
  categoryId: 'food',
  amountMinor: 2900,
} as Transaction;
let renders = 0;
let hook: ReturnType<typeof renderHook<ReturnType<typeof useActivityLedger>>>;
beforeEach(() => {
  jest.useFakeTimers();
  renders = 0;
  mockRows.mockReset();
  mockRows.mockResolvedValue([tea]);
  mockTotals.mockReset();
  mockTotals.mockResolvedValue({ period: 'week' });
  hook = renderHook(useActivityLedger, { onRender: () => renders++ });
});
afterEach(() => {
  hook.unmount();
  jest.useRealTimers();
});
const load = (range = week, scope: 'week' | 'month' = 'week') =>
  act(async () => {
    await hook.result.current.load(range, scope);
  });

it('lands the entries, the lists they refer to, the totals and the period together', async () => {
  expect(hook.result.current.loadedPeriod.fromDate).toBe('');
  const before = renders;
  await load();
  expect(hook.result.current.transactions).toEqual([tea]);
  expect(hook.result.current.accounts).toHaveLength(1);
  expect(hook.result.current.categories).toHaveLength(1);
  expect(hook.result.current.comparison).toEqual({ period: 'week' });
  expect(hook.result.current.loadedPeriod).toEqual({ ...week, scope: 'week' });
  expect(hook.result.current.loadError).toBeNull();
  // One update for all of it.
  expect(renders - before).toBe(1);
});

it('keeps the very same lists when a reload finds nothing new, so no day redraws for it', async () => {
  await load();
  const kept = [
    hook.result.current.transactions,
    hook.result.current.accounts,
    hook.result.current.categories,
  ];
  mockRows.mockResolvedValue([{ ...tea }]);
  await load();
  expect([
    hook.result.current.transactions,
    hook.result.current.accounts,
    hook.result.current.categories,
  ]).toEqual(kept);
  expect(hook.result.current.transactions).toBe(kept[0]);
  expect(hook.result.current.accounts).toBe(kept[1]);
  expect(hook.result.current.categories).toBe(kept[2]);
});

it('shows the entries when only the totals fail, and says so', async () => {
  mockTotals.mockRejectedValue(new Error('db locked'));
  let ok: boolean | undefined;
  await act(async () => {
    ok = await hook.result.current.load(week, 'week');
  });
  expect(ok).toBe(false);
  expect(hook.result.current.transactions).toEqual([tea]);
  expect(hook.result.current.comparison).toBeNull();
  expect(hook.result.current.comparisonFailed).toBe(true);
  expect(hook.result.current.loadError).toBeNull();
});

it('keeps what was on screen and reports the error when the entries cannot be read', async () => {
  await load();
  mockRows.mockRejectedValue(new Error('disk full'));
  await load({ fromDate: '2026-09-13', toDate: '2026-09-19' });
  expect(hook.result.current.loadError).toBe('disk full');
  expect(hook.result.current.transactions).toEqual([tea]);
  expect(hook.result.current.loadedPeriod.fromDate).toBe(week.fromDate);
  mockRows.mockResolvedValue([tea]);
  await load();
  expect(hook.result.current.loadError).toBeNull();
});

it('lets only the newest load write, even when an earlier one finishes last', async () => {
  let finishFirst!: (rows: Transaction[]) => void;
  mockRows.mockImplementationOnce(() => new Promise((resolve) => (finishFirst = resolve)));
  const older = { fromDate: '2026-09-13', toDate: '2026-09-19' };
  let first!: Promise<boolean>;
  act(() => {
    first = hook.result.current.load(older, 'week');
  });
  await load();
  expect(hook.result.current.loadedPeriod.fromDate).toBe(week.fromDate);
  await act(async () => {
    finishFirst([{ ...tea, id: 'stale' }]);
    await first;
  });
  expect(hook.result.current.loadedPeriod.fromDate).toBe(week.fromDate);
  expect(hook.result.current.transactions.map((t) => t.id)).toEqual(['tea']);
});
