import { act } from 'react-test-renderer';
import { renderHook } from '@/test-support/renderHook';
import type { BudgetProgress, LapsedBudget } from '@/db/budgets';

const mockShowUndo = jest.fn();
const mockAlert = jest.fn();
const mockCreate = jest.fn(async (..._args: unknown[]) => undefined);
const mockDelete = jest.fn(async (..._args: unknown[]) => ({ snapshot: true }));
const mockRestore = jest.fn(async (..._args: unknown[]) => undefined);
const mockContinueAll = jest.fn(async (..._args: unknown[]) => [] as string[]);
jest.mock('@/components/UndoToast', () => ({ useUndoToast: () => ({ show: mockShowUndo }) }));
jest.mock('@/components/AppDialog', () => ({ showAlert: (...args: unknown[]) => mockAlert(...args) }));
jest.mock('@/lib/haptics', () => ({ haptics: { tap: jest.fn(), warn: jest.fn() } }));
jest.mock('@/db/budgets', () => ({
  createBudget: (...args: unknown[]) => mockCreate(...args),
  deleteBudget: (...args: unknown[]) => mockDelete(...args),
  restoreBudget: (...args: unknown[]) => mockRestore(...args),
}));
jest.mock('./continueBudgets', () => ({ continueBudgets: (...args: unknown[]) => mockContinueAll(...args) }));

import { useBudgetActions } from './useBudgetActions';

const lapsed = (categoryId: string) =>
  ({ categoryId, limitAmountMinor: 500, rollover: false }) as unknown as LapsedBudget;
const row = { budget: { id: 'b1' }, categoryName: 'Food', parentName: null } as unknown as BudgetProgress;
const LAPSED = [lapsed('old')];

function setup(reload = jest.fn(async () => {})) {
  const hook = renderHook(
    ({ list }: { list: LapsedBudget[] }) =>
      useBudgetActions({ periodMonth: '2026-11', lapsed: list, reload }),
    { initialProps: { list: LAPSED } }
  );
  return { ...hook, reload };
}

beforeEach(() => jest.clearAllMocks());

describe('useBudgetActions', () => {
  it('continues a lapsed budget into the month, once even when tapped twice', async () => {
    const { result, reload } = setup();
    await act(async () => {
      void result.current.onContinue(LAPSED[0]);
      void result.current.onContinue(LAPSED[0]);
    });
    expect(mockCreate).toHaveBeenCalledTimes(1);
    expect(mockCreate).toHaveBeenCalledWith({
      categoryId: 'old',
      limitAmountMinor: 500,
      rollover: false,
      periodMonth: '2026-11',
    });
    expect(reload).toHaveBeenCalledTimes(1);
    expect(result.current.continuingId).toBeNull();
    expect(result.current.busy).toBe(false);
  });

  it('says why a budget did not continue, and lets it be tried again', async () => {
    mockCreate.mockRejectedValueOnce(new Error('Already exists'));
    const { result } = setup();
    await act(async () => result.current.onContinue(LAPSED[0]));
    expect(mockAlert).toHaveBeenCalledWith('Couldn’t continue budget', 'Already exists');
    expect(result.current.isBusy()).toBe(false);
  });

  it('continues every lapsed budget as the list is when it is pressed', async () => {
    const { result, rerender } = setup();
    const later = [lapsed('a'), lapsed('b')];
    rerender({ list: later });
    await act(async () => result.current.onContinueAll());
    expect(mockContinueAll).toHaveBeenCalledWith(later, '2026-11');
  });

  it('names the budgets that could not continue', async () => {
    mockContinueAll.mockResolvedValueOnce(['Travel: no limit']);
    const { result } = setup();
    await act(async () => result.current.onContinueAll());
    expect(mockAlert).toHaveBeenCalledWith('Some budgets couldn’t continue', 'Travel: no limit');
  });

  it('deletes a budget and offers an undo that restores it and reloads', async () => {
    const { result, reload } = setup();
    await act(async () => result.current.onDelete(row));
    expect(mockDelete).toHaveBeenCalledWith('b1');
    expect(reload).toHaveBeenCalledTimes(1);
    const [message, undo] = mockShowUndo.mock.calls[0];
    expect(message).toBe('Deleted "Food" budget');
    await act(async () => undo());
    expect(mockRestore).toHaveBeenCalledWith({ snapshot: true });
    expect(reload).toHaveBeenCalledTimes(2);
  });

  it('is busy while one action runs, so a second one is ignored', async () => {
    let finish!: () => void;
    mockDelete.mockImplementationOnce(
      () => new Promise((resolve) => (finish = () => resolve({ snapshot: true })))
    );
    const { result } = setup();
    act(() => void result.current.onDelete(row));
    expect(result.current.isBusy()).toBe(true);
    expect(result.current.busy).toBe(true);
    await act(async () => result.current.onContinue(LAPSED[0]));
    expect(mockCreate).not.toHaveBeenCalled();
    await act(async () => finish());
    expect(result.current.isBusy()).toBe(false);
  });

  it('keeps its functions the same across redraws, so rows and sheets holding them are not drawn again', async () => {
    const { result, rerender } = setup();
    const before = { ...result.current };
    rerender({ list: [lapsed('other')] });
    expect(result.current.onContinue).toBe(before.onContinue);
    expect(result.current.onContinueAll).toBe(before.onContinueAll);
    expect(result.current.onDelete).toBe(before.onDelete);
    expect(result.current.isBusy).toBe(before.isBusy);
  });
});
