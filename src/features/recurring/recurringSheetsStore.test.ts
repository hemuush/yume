import type { SubscriptionSuggestion } from '@/db/subscriptions';
import type { RecurringRule } from '@/types';
import { createRecurringSheets } from './recurringSheetsStore';

const rule = { id: 'r1' } as RecurringRule;
const suggestion = { key: 's1' } as SubscriptionSuggestion;

describe('the Recurring page sheets', () => {
  it('starts with everything closed', () => {
    expect(createRecurringSheets().get()).toEqual({
      rule: null,
      adding: false,
      suggestion: null,
      accountForm: false,
      runDate: null,
    });
  });

  it('opens the rule form for a rule, for a new one, or for a suggestion, and closes it whichever it was', () => {
    const sheets = createRecurringSheets();
    sheets.openRule(rule);
    expect(sheets.get().rule).toBe(rule);
    sheets.closeForm();
    sheets.openAdd();
    expect(sheets.get().adding).toBe(true);
    sheets.closeForm();
    sheets.fromSuggestion(suggestion);
    expect(sheets.get().suggestion).toBe(suggestion);
    sheets.closeForm();
    expect(sheets.get()).toMatchObject({ rule: null, adding: false, suggestion: null });
  });

  it('closes only the rule being edited when it is deleted', () => {
    const sheets = createRecurringSheets();
    sheets.openRule(rule);
    sheets.closeEditing();
    expect(sheets.get().rule).toBeNull();
  });

  it('lists a day’s entries, and a rule picked from it opens its form in place of the list', () => {
    const sheets = createRecurringSheets();
    sheets.openRunDate('2026-11-20');
    expect(sheets.get().runDate).toBe('2026-11-20');
    sheets.editFromRunDate(rule);
    expect(sheets.get()).toMatchObject({ runDate: null, rule });
  });

  it('opens and closes the new-account form on its own', () => {
    const sheets = createRecurringSheets();
    sheets.openAdd();
    sheets.openAccountForm();
    expect(sheets.get()).toMatchObject({ adding: true, accountForm: true });
    sheets.closeAccountForm();
    expect(sheets.get()).toMatchObject({ adding: true, accountForm: false });
  });
});
