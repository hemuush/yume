/** The entries of the heatmap day under the inspector: read a moment after the finger settles, newest read wins. */
import { act } from 'react-test-renderer';
import { renderHook } from '@/test-support/renderHook';
import type { Category, Transaction } from '@/types';

const mockList = jest.fn<Promise<Transaction[]>, [unknown]>();
jest.mock('@/db/ledger', () => ({ listTransactions: (args: unknown) => mockList(args) }));
jest.mock('@/db/settings', () => ({ getCachedCurrency: () => 'INR' }));

import { useDayEntries } from './useDayEntries';

type Props = Parameters<typeof useDayEntries>[0];
const tx = (id: string, categoryId: string | null = 'food') =>
  ({ id, type: 'expense', accountId: 'bank', toAccountId: null, categoryId }) as Transaction;
const food = { id: 'food', name: 'Food' } as Category;
const stocks = { id: 'stocks', name: 'Stocks', isSensitive: true } as Category;
const catById = new Map([food, stocks].map((c) => [c.id, c]));
const noSavings = new Set<string>();

let hook: ReturnType<typeof renderHook<ReturnType<typeof useDayEntries>, Props>>;
const props = (over: Partial<Props> = {}): Props => ({
  iso: '2026-10-05',
  hideAmounts: false,
  catById,
  savingsIds: noSavings,
  ...over,
});
beforeEach(() => {
  jest.useFakeTimers();
  mockList.mockReset();
  mockList.mockResolvedValue([tx('a')]);
  hook = renderHook(useDayEntries, { initialProps: props() });
});
afterEach(() => {
  hook.unmount();
  jest.useRealTimers();
});
const wait = (ms: number) =>
  act(async () => {
    jest.advanceTimersByTime(ms);
  });

it('reads the day a moment after it is picked, and has nothing to show until then', async () => {
  expect(hook.result.current.txs).toBeNull();
  await wait(100);
  expect(mockList).not.toHaveBeenCalled();
  await wait(50);
  expect(mockList).toHaveBeenCalledWith({ fromDate: '2026-10-05', toDate: '2026-10-05', currency: 'INR' });
  expect(hook.result.current.txs?.map((t) => t.id)).toEqual(['a']);
});

it('reads only where the finger rests when days are touched in quick succession', async () => {
  for (const iso of ['2026-10-06', '2026-10-07', '2026-10-08']) {
    hook.rerender(props({ iso }));
    await wait(40);
  }
  await wait(200);
  expect(mockList).toHaveBeenCalledTimes(1);
  expect(mockList).toHaveBeenCalledWith(expect.objectContaining({ fromDate: '2026-10-08' }));
});

it('shows nothing of another day while the new one is read', async () => {
  await wait(200);
  hook.rerender(props({ iso: '2026-10-06' }));
  expect(hook.result.current.txs).toBeNull();
});

it('does not read the day again when the lists it filters by are rebuilt with the same content', async () => {
  await wait(200);
  mockList.mockClear();
  hook.rerender(props());
  await wait(200);
  expect(mockList).not.toHaveBeenCalled();
});

it('leaves savings and investments out while amounts are hidden', async () => {
  mockList.mockResolvedValue([tx('shop'), tx('shares', 'stocks')]);
  hook.rerender(props({ hideAmounts: true }));
  await wait(200);
  expect(hook.result.current.txs?.map((t) => t.id)).toEqual(['shop']);
});

it('reports a failed read, and reads again on retry', async () => {
  mockList.mockRejectedValueOnce(new Error('db locked'));
  hook.rerender(props({ iso: '2026-10-09' }));
  await wait(200);
  expect(hook.result.current.error).toBe('db locked');
  await act(async () => hook.result.current.retry());
  await wait(200);
  expect(hook.result.current.error).toBeNull();
  expect(hook.result.current.txs?.map((t) => t.id)).toEqual(['a']);
});
