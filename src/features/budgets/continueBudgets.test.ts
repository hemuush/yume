import { continueBudgets } from './continueBudgets';
import type { LapsedBudget } from '@/db/budgets';
jest.mock('@/db/budgets', () => ({ createBudget: jest.fn() }));
const items = ['Food', 'Travel', 'Home'].map(
  (name) =>
    ({ categoryId: name, categoryName: name, limitAmountMinor: 50000, rollover: false }) as LapsedBudget
);
it('continues later budgets after a failure and reports the failed category', async () => {
  const create = jest
    .fn()
    .mockResolvedValueOnce({})
    .mockRejectedValueOnce(new Error('Unavailable'))
    .mockResolvedValueOnce({});
  expect(await continueBudgets(items, '2026-10', create)).toEqual(['Travel: Unavailable']);
  expect(create).toHaveBeenCalledTimes(3);
  expect(create).toHaveBeenLastCalledWith(
    expect.objectContaining({ categoryId: 'Home', periodMonth: '2026-10' })
  );
});
it('does not promise success when every write fails', async () => {
  const create = jest.fn().mockRejectedValue(new Error('Storage full'));
  expect(await continueBudgets(items, '2026-10', create)).toHaveLength(3);
});
