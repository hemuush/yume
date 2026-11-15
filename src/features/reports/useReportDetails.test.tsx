/** What Reports reads on top of a period's main load: fetched once the period's data has landed, and again after a reload. */
import { act } from 'react-test-renderer';
import { renderHook } from '@/test-support/renderHook';

const mockLargest = jest.fn();
const mockSplit = jest.fn();
const mockAccounts = jest.fn();
const mockDaily = jest.fn();
jest.mock('@/db/reports', () => ({
  getLargestExpenses: (...a: unknown[]) => mockLargest(...a),
  getSubcategoryBreakdown: (...a: unknown[]) => mockSplit(...a),
  getAccountBreakdown: (...a: unknown[]) => mockAccounts(...a),
  getDailyExpenseTotals: (...a: unknown[]) => mockDaily(...a),
}));

import { useReportDetails, BIGGEST_COUNT } from './useReportDetails';

type Props = Parameters<typeof useReportDetails>[0];
const month = { granularity: 'month', offset: 0 } as const;
const props = (over: Partial<Props> = {}): Props => ({
  cursor: month,
  cursorKey: 'month:0',
  hideAmounts: false,
  ready: true,
  version: 1,
  flow: 'expense',
  group: 'category',
  catFilter: null,
  selectedCat: null,
  ...over,
});
let hook: ReturnType<typeof renderHook<ReturnType<typeof useReportDetails>, Props>>;
const mount = async (over: Partial<Props> = {}) => {
  await act(async () => {
    hook = renderHook(useReportDetails, { initialProps: props(over) });
  });
};
const show = (over: Partial<Props>) =>
  act(async () => {
    hook.rerender(props(over));
  });
beforeEach(() => {
  [mockLargest, mockSplit, mockAccounts, mockDaily].forEach((m) => m.mockReset());
  mockLargest.mockResolvedValue([{ id: 'big' }]);
  mockSplit.mockResolvedValue([{ categoryId: 'sub' }]);
  mockAccounts.mockResolvedValue([{ accountId: 'bank' }]);
  mockDaily.mockResolvedValue([{ date: '2026-10-02', totalMinor: 1 }]);
});
afterEach(() => hook.unmount());

it('reads the biggest spends of the period up to today, once, and keys them to what they were read for', async () => {
  await mount();
  expect(mockLargest).toHaveBeenCalledTimes(1);
  const [range, count, hide, cat] = mockLargest.mock.calls[0];
  expect(count).toBe(BIGGEST_COUNT);
  expect([hide, cat]).toEqual([false, undefined]);
  expect(range.start).toMatch(/^\d{4}-\d{2}-01$/);
  expect(hook.result.current.largest?.key).toBe(hook.result.current.largestKey);
});

it('reads nothing until the period’s own data has landed, so nothing is read twice for one step', async () => {
  await mount({ ready: false });
  expect(mockLargest).not.toHaveBeenCalled();
  await show({ ready: true, version: 2 });
  expect(mockLargest).toHaveBeenCalledTimes(1);
});

it('reads again after a fresh load of the same period, and not for a re-render', async () => {
  await mount();
  await show({});
  expect(mockLargest).toHaveBeenCalledTimes(1);
  await show({ version: 2 });
  expect(mockLargest).toHaveBeenCalledTimes(2);
});

it('narrows the biggest spends and the heatmap’s days to the category picked', async () => {
  await mount({ catFilter: 'food' });
  expect(mockLargest.mock.calls[0][3]).toBe('food');
  expect(mockDaily).toHaveBeenCalledWith(expect.anything(), false, 'food');
  expect(hook.result.current.filtered?.id).toBe('food');
});

it('reads a picked category’s subcategories only while one is picked', async () => {
  await mount();
  expect(mockSplit).not.toHaveBeenCalled();
  await show({ selectedCat: 'food' });
  expect(mockSplit).toHaveBeenCalledWith('food', expect.anything(), 'expense');
  expect(hook.result.current.split?.id).toBe('food');
});

it('reads the accounts only when the breakdown is grouped by account, keyed to the period and flow', async () => {
  await mount();
  expect(mockAccounts).not.toHaveBeenCalled();
  await show({ group: 'account' });
  expect(mockAccounts).toHaveBeenCalledTimes(1);
  expect(hook.result.current.accounts?.key).toBe(hook.result.current.accountsKey);
  expect(hook.result.current.accountsKey).toBe('month:0|expense|false');
});

it('says which read failed, and reads again on retry', async () => {
  mockLargest.mockRejectedValueOnce(new Error('db locked'));
  await mount();
  expect(hook.result.current.errors).toEqual({ largest: 'db locked' });
  await act(async () => hook.result.current.retry());
  expect(hook.result.current.errors).toEqual({});
  expect(hook.result.current.largest?.items).toEqual([{ id: 'big' }]);
});

it('forgets a failure when the period, filter or flow changes', async () => {
  mockLargest.mockRejectedValueOnce(new Error('db locked'));
  await mount();
  expect(Object.keys(hook.result.current.errors)).toEqual(['largest']);
  await show({ cursorKey: 'month:-1', cursor: { granularity: 'month', offset: -1 } });
  expect(hook.result.current.errors).toEqual({});
});
