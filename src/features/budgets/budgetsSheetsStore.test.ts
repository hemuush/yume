import type { BudgetProgress } from '@/db/budgets';
import { createBudgetsSheets } from './budgetsSheetsStore';

const progress = (id: string) => ({ budget: { id } }) as BudgetProgress;

describe('the Budgets page sheets', () => {
  it('starts with everything closed', () => {
    expect(createBudgetsSheets().get()).toEqual({ detailId: null, form: null, manage: null });
  });

  it('opens and closes a budget’s detail', () => {
    const sheets = createBudgetsSheets();
    sheets.openDetail('b1');
    expect(sheets.get().detailId).toBe('b1');
    sheets.closeDetail();
    expect(sheets.get().detailId).toBeNull();
  });

  it('opens the form for a new budget, or for the limit of one', () => {
    const sheets = createBudgetsSheets();
    sheets.openForm();
    expect(sheets.get().form).toEqual({ editing: null });
    sheets.closeForm();
    const editing = progress('b1');
    sheets.openForm(editing);
    expect(sheets.get().form?.editing).toBe(editing);
    sheets.closeForm();
    expect(sheets.get().form).toBeNull();
  });

  it('keeps the menu, the form and the detail apart', () => {
    const sheets = createBudgetsSheets();
    const target = progress('b1');
    sheets.openManage(target);
    sheets.openForm(target);
    sheets.closeManage();
    expect(sheets.get()).toMatchObject({ manage: null, form: { editing: target } });
  });
});
