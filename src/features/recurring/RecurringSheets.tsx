import { memo, useMemo } from 'react';
import { AddAccountModal } from '@/features/profile/AddAccountModal';
import { nextMonthlyDateAfter, toLocalIsoDate } from '@/lib/date';
import type { Account, Category, RecurringRule } from '@/types';
import { RuleModal } from './RuleModal';
import { RunDateSheet } from './RunDateSheet';
import { useRecurringSheets, type RecurringSheets as RecurringSheetsStore } from './recurringSheetsStore';

/**
 * The sheets the Recurring page opens: the rule form (to add, edit, or "Make recurring" from a suggestion), a day's
 * entries and the new-account form. Which is open lives in `sheets`, so the page behind does not redraw when one opens
 * or closes.
 */
export const RecurringSheets = memo(function RecurringSheets({
  sheets,
  accounts,
  categories,
  categoriesById,
  activeRules,
  masked,
  investIds,
  accountName,
  todayIso,
  busyRuleIds,
  onTogglePause,
  reload,
}: {
  sheets: RecurringSheetsStore;
  accounts: Account[];
  categories: Category[];
  categoriesById: Map<string, Category>;
  activeRules: RecurringRule[];
  masked: ReadonlySet<string>;
  investIds: ReadonlySet<string>;
  accountName: (id: string) => string;
  todayIso: string;
  busyRuleIds: ReadonlySet<string>;
  onTogglePause: (rule: RecurringRule) => void;
  /** Reloads the page in place after something was saved or deleted in a sheet. */
  reload: () => Promise<void>;
}) {
  const { rule, adding, suggestion, accountForm, runDate } = useRecurringSheets(sheets);
  // Memoized: the form resets whenever its prefill changes identity, so a fresh object each render would wipe whatever
  // was typed.
  const prefill = useMemo(
    () =>
      suggestion
        ? {
            type: 'expense' as const,
            accountId: suggestion.accountId,
            toAccountId: null,
            categoryId: suggestion.categoryId,
            amountMinor: suggestion.amountMinor,
            note: suggestion.note,
            nextRunDate: nextMonthlyDateAfter(suggestion.date, toLocalIsoDate(new Date())),
          }
        : undefined,
    [suggestion]
  );
  return (
    <>
      <RuleModal
        visible={adding || !!rule || !!suggestion}
        editing={rule}
        accounts={accounts}
        categories={categories}
        prefill={prefill}
        onClose={sheets.closeForm}
        onSaved={async () => {
          sheets.closeForm();
          await reload();
        }}
        onDeleted={async () => {
          sheets.closeEditing();
          await reload();
        }}
      />
      <RunDateSheet
        date={runDate}
        activeRules={activeRules}
        masked={masked}
        accounts={accounts}
        categoriesById={categoriesById}
        investIds={investIds}
        accountName={accountName}
        todayIso={todayIso}
        busyRuleIds={busyRuleIds}
        onClose={sheets.closeRunDate}
        onTogglePause={onTogglePause}
        onOpen={sheets.editFromRunDate}
      />
      <AddAccountModal
        visible={accountForm}
        onClose={sheets.closeAccountForm}
        onCreated={async () => {
          sheets.closeAccountForm();
          await reload();
        }}
      />
    </>
  );
});
