/** Opening the purchase behind a pending refund: one at a time, newest only, and dropped when Home is left. */
import { act } from 'react-test-renderer';
import { renderHook } from '@/test-support/renderHook';
import type { Transaction } from '@/types';

let mockCleanups: (() => void)[] = [];
jest.mock('expo-router', () => ({
  useFocusEffect: (cb: () => void | (() => void)) =>
    require('react').useEffect(() => {
      const cleanup = cb();
      if (cleanup) mockCleanups.push(cleanup);
      return cleanup;
    }, [cb]),
}));
const mockGet = jest.fn<Promise<Transaction | null>, [string]>();
jest.mock('@/db/transactions', () => ({ getTransactionById: (id: string) => mockGet(id) }));
const mockAlert = jest.fn();
jest.mock('@/components/AppDialog', () => ({ showAlert: (...args: unknown[]) => mockAlert(...args) }));

import { createHomeSheets } from './homeSheetsStore';
import { useOpenRefund } from './useOpenRefund';

const purchase = { id: 'p1' } as Transaction;
let sheets: ReturnType<typeof createHomeSheets>;
let hook: ReturnType<typeof renderHook<ReturnType<typeof useOpenRefund>>>;
beforeEach(() => {
  mockCleanups = [];
  mockGet.mockReset();
  mockAlert.mockReset();
  sheets = createHomeSheets();
  hook = renderHook(() => useOpenRefund(sheets));
});
afterEach(() => hook.unmount());
const open = (id: string) =>
  act(async () => {
    await hook.result.current.open(id);
  });

it('opens the purchase in its sheet, and is idle again afterwards', async () => {
  mockGet.mockResolvedValue(purchase);
  await open('p1');
  expect(sheets.get().entry).toBe(purchase);
  expect(hook.result.current.opening).toBeNull();
});

it('names the one being fetched while it is, and takes a second request for nothing until it is done', async () => {
  let finish!: (tx: Transaction | null) => void;
  mockGet.mockImplementationOnce(() => new Promise((resolve) => (finish = resolve)));
  let first!: Promise<void>;
  act(() => {
    first = hook.result.current.open('p1');
  });
  expect(hook.result.current.opening).toBe('p1');
  await open('p2');
  expect(mockGet).toHaveBeenCalledTimes(1);
  await act(async () => {
    finish(purchase);
    await first;
  });
  expect(hook.result.current.opening).toBeNull();
});

it('says so when the purchase has been deleted, and opens nothing', async () => {
  mockGet.mockResolvedValue(null);
  await open('p1');
  expect(mockAlert).toHaveBeenCalledWith('Purchase unavailable', expect.stringContaining('deleted'));
  expect(sheets.get().entry).toBeNull();
  expect(hook.result.current.opening).toBeNull();
});

it('says so when it cannot be read', async () => {
  mockGet.mockRejectedValue(new Error('disk full'));
  await open('p1');
  expect(mockAlert).toHaveBeenCalledWith('Couldn’t open the refund', 'disk full');
  expect(hook.result.current.opening).toBeNull();
});

it('drops a request when it is cancelled, so the purchase does not open late', async () => {
  let finish!: (tx: Transaction | null) => void;
  mockGet.mockImplementationOnce(() => new Promise((resolve) => (finish = resolve)));
  let pending!: Promise<void>;
  act(() => {
    pending = hook.result.current.open('p1');
  });
  act(() => hook.result.current.cancel());
  expect(hook.result.current.opening).toBeNull();
  await act(async () => {
    finish(purchase);
    await pending;
  });
  expect(sheets.get().entry).toBeNull();
  // And a new request is accepted straight away.
  mockGet.mockResolvedValue(purchase);
  await open('p1');
  expect(sheets.get().entry).toBe(purchase);
});

it('drops a request still in flight when Home is left', async () => {
  let finish!: (tx: Transaction | null) => void;
  mockGet.mockImplementationOnce(() => new Promise((resolve) => (finish = resolve)));
  let pending!: Promise<void>;
  act(() => {
    pending = hook.result.current.open('p1');
  });
  act(() => mockCleanups.forEach((cleanup) => cleanup()));
  await act(async () => {
    finish(purchase);
    await pending;
  });
  expect(sheets.get().entry).toBeNull();
});
