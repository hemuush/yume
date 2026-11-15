import { act } from 'react-test-renderer';
import { renderHook } from '@/test-support/renderHook';
import type { BudgetProgress, LapsedBudget } from '@/db/budgets';

const mockBudgets: BudgetProgress[] = [];
const mockLapsed: LapsedBudget[] = [];
const mockAccounts: { id: string; balanceMinor: number }[] = [];
const mockGate: { release: (() => void) | null } = { release: null };
jest.mock('@/db/budgets', () => ({
  listBudgetsForMonth: async (month: string) => {
    const snapshot = JSON.parse(JSON.stringify(mockBudgets));
    // A month read that is still in flight when the page moves on.
    if (month === 'slow') {
      await new Promise<void>((resolve) => {
        mockGate.release = resolve;
      });
    }
    return snapshot;
  },
  listLapsedBudgets: async () => JSON.parse(JSON.stringify(mockLapsed)),
}));
jest.mock('@/db/ledger', () => ({
  listCategories: async () => [{ id: 'food', name: 'Food' }],
  listAccounts: async () => JSON.parse(JSON.stringify(mockAccounts)),
}));
jest.mock('@/lib/useScreenLoad', () => ({
  useScreenLoad: (load: () => Promise<void>) => {
    const React = require('react');
    const [loaded, setLoaded] = React.useState(false);
    React.useEffect(() => {
      void load().then(() => setLoaded(true));
    }, [load]);
    return { loaded, hasData: loaded, loadError: null, reload: load };
  },
}));

import { useBudgetsData } from './useBudgetsData';

const budget = (id: string, spentMinor: number) =>
  ({ budget: { id, categoryId: `c-${id}` }, spentMinor }) as unknown as BudgetProgress;
const useData = ({ month, hide }: { month: string; hide: boolean }) => useBudgetsData(month, hide);
const FIRST = { month: '2026-11', hide: false };

beforeEach(() => {
  mockBudgets.splice(0, mockBudgets.length, budget('a', 100), budget('b', 200));
  mockLapsed.splice(0, mockLapsed.length, { categoryId: 'old', limitAmountMinor: 500 } as LapsedBudget);
  mockAccounts.splice(0, mockAccounts.length, { id: 'bank', balanceMinor: 1000 });
  mockGate.release = null;
});

const settle = () => act(async () => {});

describe('useBudgetsData', () => {
  it('reads the month’s budgets, the lapsed ones, the categories and the accounts', async () => {
    const { result } = renderHook(useData, { initialProps: FIRST });
    await settle();
    expect(result.current.budgets.map((b) => b.budget.id)).toEqual(['a', 'b']);
    expect(result.current.lapsed.map((l) => l.categoryId)).toEqual(['old']);
    expect(result.current.categories.map((c) => c.id)).toEqual(['food']);
    expect(result.current.accounts.map((a) => a.id)).toEqual(['bank']);
    expect(result.current.loaded).toBe(true);
  });

  it('draws nothing again when a reload finds the same budgets', async () => {
    const renders = jest.fn();
    const { result } = renderHook(useData, { initialProps: FIRST, onRender: renders });
    await settle();
    const before = { ...result.current };
    const drawn = renders.mock.calls.length;
    await act(async () => {
      await result.current.reload();
    });
    expect(result.current.budgets).toBe(before.budgets);
    expect(result.current.accounts).toBe(before.accounts);
    expect(renders.mock.calls.length).toBe(drawn);
  });

  it('keeps each budget that did not change, so only the one that spent more is drawn again', async () => {
    const { result } = renderHook(useData, { initialProps: FIRST });
    await settle();
    const before = { ...result.current };
    mockBudgets[1] = budget('b', 350);
    await act(async () => {
      await result.current.reload();
    });
    expect(result.current.budgets[0]).toBe(before.budgets[0]);
    expect(result.current.budgets[1]).not.toBe(before.budgets[1]);
    expect(result.current.categories).toBe(before.categories);
  });

  it('keeps an account whose balance did not move while another one did', async () => {
    mockAccounts.push({ id: 'cash', balanceMinor: 50 });
    const { result } = renderHook(useData, { initialProps: FIRST });
    await settle();
    const before = { ...result.current };
    mockAccounts[1] = { id: 'cash', balanceMinor: 80 };
    await act(async () => {
      await result.current.reload();
    });
    expect(result.current.accounts[0]).toBe(before.accounts[0]);
    expect(result.current.accounts[1]).not.toBe(before.accounts[1]);
  });

  it('never lets a read for another month land after the page has moved on', async () => {
    const { result, rerender } = renderHook(useData, { initialProps: { month: 'slow', hide: false } });
    await settle();
    expect(mockGate.release).not.toBeNull();
    mockBudgets.splice(0, mockBudgets.length, budget('new', 1));
    rerender(FIRST);
    await settle();
    expect(result.current.budgets.map((b) => b.budget.id)).toEqual(['new']);
    // The slow read had taken the old budgets; it finishes last and is thrown away.
    await act(async () => mockGate.release!());
    expect(result.current.budgets.map((b) => b.budget.id)).toEqual(['new']);
  });
});
