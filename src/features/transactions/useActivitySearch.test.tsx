/** Activity's search: typed text runs a moment after the last keystroke, and only the newest query may land. */
import { act } from 'react-test-renderer';
import { renderHook } from '@/test-support/renderHook';
import { BackHandler } from 'react-native';
import type { Transaction } from '@/types';

jest.mock('expo-router', () => ({
  useFocusEffect: (cb: () => void) => require('react').useEffect(cb, [cb]),
}));
const mockSearch = jest.fn(async (..._args: unknown[]): Promise<Transaction[]> => []);
jest.mock('@/db/ledger', () => ({ searchTransactions: (...args: unknown[]) => mockSearch(...args) }));
const mockSetRecent = jest.fn(async (_list: string[]) => {});
jest.mock('@/db/settings', () => ({
  RECENT_SEARCHES_KEPT: 3,
  getRecentSearches: async () => ['tea'],
  setRecentSearches: (list: string[]) => mockSetRecent(list),
}));

import { useActivitySearch } from './useActivitySearch';

const row = (id: string) => ({ id }) as Transaction;
let hook: ReturnType<typeof renderHook<ReturnType<typeof useActivitySearch>>>;
beforeEach(() => {
  jest.useFakeTimers();
  mockSearch.mockReset();
  mockSearch.mockResolvedValue([]);
  mockSetRecent.mockClear();
  hook = renderHook(useActivitySearch);
});
afterEach(() => {
  hook.unmount();
  jest.useRealTimers();
});
const type = (text: string) => act(() => hook.result.current.setQuery(text));
const wait = (ms: number) =>
  act(async () => {
    jest.advanceTimersByTime(ms);
  });

it('searches once, a moment after the last keystroke, asking for one more than the list holds', async () => {
  await act(async () => hook.result.current.open());
  for (const text of ['c', 'co', 'cof', 'coff']) {
    type(text);
    await wait(100);
  }
  expect(mockSearch).not.toHaveBeenCalled();
  expect(hook.result.current.loading).toBe(true);
  await wait(300);
  expect(mockSearch).toHaveBeenCalledTimes(1);
  expect(mockSearch).toHaveBeenCalledWith('coff', 51);
  expect(hook.result.current.loading).toBe(false);
});

it('does not search for text shorter than the minimum, and shows nothing for it', async () => {
  await act(async () => hook.result.current.open());
  type('c');
  await wait(500);
  expect(mockSearch).not.toHaveBeenCalled();
  expect(hook.result.current.results).toEqual([]);
  expect(hook.result.current.loading).toBe(false);
});

it('says there are more when the extra row comes back, and keeps only the first fifty', async () => {
  mockSearch.mockResolvedValue(Array.from({ length: 51 }, (_, i) => row(`r${i}`)));
  await act(async () => hook.result.current.open());
  type('coffee');
  await wait(300);
  expect(hook.result.current.results).toHaveLength(50);
  expect(hook.result.current.capped).toBe(true);
});

it('lets only the newest query write results', async () => {
  let finishFirst!: (rows: Transaction[]) => void;
  mockSearch.mockImplementationOnce(() => new Promise((resolve) => (finishFirst = resolve)));
  await act(async () => hook.result.current.open());
  type('coffee');
  await wait(300);
  mockSearch.mockResolvedValueOnce([row('new')]);
  type('coffees');
  await wait(300);
  expect(hook.result.current.results.map((r) => r.id)).toEqual(['new']);
  await act(async () => finishFirst([row('stale')]));
  expect(hook.result.current.results.map((r) => r.id)).toEqual(['new']);
});

it('reports a failed search, and clears it with the next one', async () => {
  mockSearch.mockRejectedValueOnce(new Error('db locked'));
  await act(async () => hook.result.current.open());
  type('coffee');
  await wait(300);
  expect(hook.result.current.failed).toBe(true);
  expect(hook.result.current.results).toEqual([]);
  await act(async () => hook.result.current.run('coffee'));
  expect(hook.result.current.failed).toBe(false);
});

it('closes to a clean slate, and ignores a query still in flight', async () => {
  let finish!: (rows: Transaction[]) => void;
  mockSearch.mockImplementationOnce(() => new Promise((resolve) => (finish = resolve)));
  await act(async () => hook.result.current.open());
  type('coffee');
  await wait(300);
  act(() => hook.result.current.close());
  await act(async () => finish([row('late')]));
  expect([
    hook.result.current.active,
    hook.result.current.query,
    hook.result.current.results,
    hook.result.current.loading,
    hook.result.current.capped,
  ]).toEqual([false, '', [], false, false]);
});

it('refreshes the open search in place, and does nothing when search is closed', async () => {
  await act(async () => hook.result.current.refresh());
  expect(mockSearch).not.toHaveBeenCalled();
  await act(async () => hook.result.current.open());
  type('coffee');
  await wait(300);
  mockSearch.mockClear();
  await act(async () => hook.result.current.refresh());
  expect(mockSearch).toHaveBeenCalledWith('coffee', 51);
});

it('remembers a search once, newest first, without repeats or more than it keeps', async () => {
  await act(async () => hook.result.current.open());
  expect(hook.result.current.recent).toEqual(['tea']);
  act(() => hook.result.current.remember('c'));
  expect(mockSetRecent).not.toHaveBeenCalled();
  for (const text of ['coffee', 'rent', 'fuel', 'COFFEE'])
    act(() => hook.result.current.remember(` ${text} `));
  expect(hook.result.current.recent).toEqual(['COFFEE', 'fuel', 'rent']);
  expect(mockSetRecent).toHaveBeenLastCalledWith(['COFFEE', 'fuel', 'rent']);
  act(() => hook.result.current.clearRecent());
  expect(hook.result.current.recent).toEqual([]);
  expect(mockSetRecent).toHaveBeenLastCalledWith([]);
});

it('leaves search with the phone’s back button, as Cancel does', async () => {
  const remove = jest.fn();
  const add = jest.spyOn(BackHandler, 'addEventListener').mockReturnValue({ remove } as never);
  try {
    await act(async () => hook.result.current.open());
    const onBack = add.mock.calls.at(-1)![1] as () => boolean;
    let handled = false;
    act(() => {
      handled = onBack();
    });
    expect(handled).toBe(true);
    expect(hook.result.current.active).toBe(false);
    expect(remove).toHaveBeenCalled();
  } finally {
    add.mockRestore();
  }
});
