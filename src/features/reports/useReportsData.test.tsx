/** What Reports reads for a period: loaded together, newest load wins, and kept the same when a reload finds nothing new. */
import { act } from 'react-test-renderer';
import { renderHook } from '@/test-support/renderHook';
import type { ReportWindow } from '@/lib/period';

let mockHide = false;
jest.mock('@/theme/PrivacyContext', () => ({ usePrivacy: () => ({ hideAmounts: mockHide }) }));
jest.mock('expo-router', () => ({ useFocusEffect: () => {} }));
jest.mock('@/hooks/useLocalDayRefresh', () => ({ useLocalDayRefresh: () => {} }));
const empty = {
  incomeMinor: 0,
  expenseMinor: 0,
  netMinor: 0,
  savingsContributionMinor: 0,
  categoryBreakdown: [],
  incomeBreakdown: [],
};
const mockComparison = jest.fn();
const mockDaily = jest.fn();
jest.mock('@/db/reports', () => ({
  getRangeComparison: (...a: unknown[]) => mockComparison(...a),
  getMonthlyExpenseTrend: async () => [{ label: 'Oct', totalMinor: 100 }],
  getNetWorthTrend: async () => [{ label: 'Oct', netWorthMinor: 1000 }],
  getMonthlyCashFlow: async () => [
    { month: '2026-10', label: 'Oct', incomeMinor: 10, expenseMinor: 7, recorded: true },
  ],
  getCategoryMonthlyTotals: async () => [
    { categoryId: 'food', name: 'Food', color: '#fff', totalsMinor: [1] },
  ],
  getDailyExpenseTotals: (...a: unknown[]) => mockDaily(...a),
}));
jest.mock('@/db/ledger', () => ({
  listCategories: async () => [{ id: 'food', name: 'Food' }],
  listAccounts: async () => [{ id: 'bank', type: 'bank' }],
}));
jest.mock('@/db/budgets', () => ({ listBudgetsForMonth: async () => [] }));
jest.mock('@/db/tidyUp', () => ({ findStartingBalances: async () => [{ categoryName: 'Opening' }] }));

import { useReportsData } from './useReportsData';

const october: ReportWindow = { granularity: 'month', offset: 0 };
const september: ReportWindow = { granularity: 'month', offset: -1 };
type Hook = ReturnType<typeof renderHook<ReturnType<typeof useReportsData>, { c: ReportWindow }>>;
let hook: Hook;
let started = 0;
beforeEach(() => {
  mockHide = false;
  started = 0;
  mockComparison.mockReset();
  mockComparison.mockResolvedValue({ period: 'month', current: empty, previous: empty });
  mockDaily.mockReset();
  mockDaily.mockResolvedValue([{ date: '2026-10-02', totalMinor: 5 }]);
  hook = renderHook<ReturnType<typeof useReportsData>, { c: ReportWindow }>(
    ({ c }) => useReportsData(c, { onLoadStart: () => started++ }),
    {
      initialProps: { c: october },
    }
  );
});
afterEach(() => hook.unmount());
const load = (c = october) =>
  act(async () => {
    await hook.result.current.load(c);
  });

it('is not ready until a load lands, and then holds everything that was read', async () => {
  expect(hook.result.current.ready).toBe(false);
  await load();
  const r = hook.result.current;
  expect(r.ready).toBe(true);
  expect(r.status).toBe('ready');
  expect(r.comparison?.current).toEqual(empty);
  expect(r.trend).toHaveLength(1);
  expect(r.netWorthTrend).toHaveLength(1);
  expect(r.cashFlow).toHaveLength(1);
  expect(r.catTracks[0].totalsMinor).toEqual([1]);
  expect(r.categories).toHaveLength(1);
  expect(r.startingBalanceNames).toEqual(['Opening']);
  expect(r.version).toBe(1);
  expect(started).toBe(1);
});

it('is not ready for a period whose data has not landed, however much of another is held', async () => {
  await load();
  expect(hook.result.current.ready).toBe(true);
  hook.rerender({ c: september });
  expect(hook.result.current.ready).toBe(false);
  await load(september);
  expect(hook.result.current.ready).toBe(true);
});

it('keeps the very same lists when a reload finds nothing new, and counts the load', async () => {
  await load();
  const before = hook.result.current;
  mockDaily.mockResolvedValue([{ date: '2026-10-02', totalMinor: 5 }]);
  await load();
  const after = hook.result.current;
  expect(after.version).toBe(2);
  expect(after.daily).toBe(before.daily);
  expect(after.trend).toBe(before.trend);
  expect(after.cashFlow).toBe(before.cashFlow);
  expect(after.categories).toBe(before.categories);
  expect(after.savingsIds).toBe(before.savingsIds);
});

it('lets only the newest load write, even when an earlier one finishes last', async () => {
  let finishFirst!: (v: unknown) => void;
  mockComparison.mockImplementationOnce(() => new Promise((resolve) => (finishFirst = resolve)));
  let first!: Promise<boolean>;
  act(() => {
    first = hook.result.current.load(september);
  });
  hook.rerender({ c: october });
  await load(october);
  await act(async () => {
    finishFirst({ period: 'month', current: { ...empty, expenseMinor: 999 }, previous: empty });
    await first;
  });
  expect(hook.result.current.comparison?.current.expenseMinor).toBe(0);
  expect(hook.result.current.version).toBe(1);
});

it('says what went wrong when nothing has loaded, and recovers on the next load', async () => {
  mockComparison.mockRejectedValueOnce(new Error('db locked'));
  await load();
  expect(hook.result.current.status).toBe('error');
  expect(hook.result.current.errorText).toBe('db locked');
  expect(hook.result.current.ready).toBe(false);
  await load();
  expect(hook.result.current.status).toBe('ready');
  expect(hook.result.current.errorText).toBeNull();
});

it('drops the net worth trend while savings are hidden, since it counts them', async () => {
  jest.requireMock('@/db/ledger').listAccounts = async () => [{ id: 'pot', type: 'savings' }];
  mockHide = true;
  hook.rerender({ c: october });
  await load();
  expect(hook.result.current.netWorthTrend).toEqual([]);
});
