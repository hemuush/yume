import { useEffect, useMemo, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { Text } from '@/components/Text';
import { ModalSheet } from '@/components/ModalSheet';
import { SheetFlow } from '@/components/SheetFlow';
import { PrimaryButton } from '@/components/PrimaryButton';
import { RecentTransactionRow } from '@/features/home/RecentTransactionRow';
import { BudgetHero } from './BudgetHero';
import { AddBudgetModal } from './AddBudgetModal';
import type { BudgetProgress } from '@/db/budgets';
import { listTransactions } from '@/db/ledger';
import type { Account, Category, Transaction } from '@/types';
import { usePrivacy } from '@/theme/PrivacyContext';
import { isSavingsEntry } from '@/lib/privateSummary';
import { savingsAccountIdsOf } from '@/lib/account';
import { categorySentence, parentNameOf } from '@/lib/categoryLabel';
import { formatMoney } from '@/lib/money';
import { toLocalIsoDate } from '@/lib/date';
import { shortMonthYear } from '@/lib/dateLabels';
import { budgetPace, BUDGET_PACE_LABEL } from '@/lib/pace';
import { errorMessage } from '@/lib/errorMessage';
import { theme } from '@/constants/theme';

/** A budget opens for reading; changing its limit is a separate, reversible step. */
export function BudgetDetailModal({
  progress,
  categories,
  accounts,
  currency,
  onClose,
  onChanged,
}: {
  progress: BudgetProgress;
  categories: Category[];
  accounts: Account[];
  currency: string;
  onClose: () => void;
  onChanged: () => void | Promise<void>;
}) {
  const { hideAmounts } = usePrivacy();
  const [editing, setEditing] = useState(false);
  const [entries, setEntries] = useState<Transaction[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [loadedScope, setLoadedScope] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const categoriesById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
  const savingsIds = useMemo(() => savingsAccountIdsOf(accounts), [accounts]);
  const { periodMonth, categoryId } = progress.budget;
  const scope = `${categoryId}:${periodMonth}:${currency}:${hideAmounts}`;
  useEffect(() => {
    let active = true;
    setLoaded(false);
    setError(null);
    const [year, month] = periodMonth.split('-').map(Number);
    void listTransactions({
      categoryId,
      includeSubcategories: true,
      spendingOnly: true,
      currency,
      fromDate: `${periodMonth}-01`,
      toDate: `${periodMonth}-${new Date(year, month, 0).getDate()}`,
      limit: 8,
    }).then(
      (rows) => {
        if (!active) return;
        setEntries(
          rows.filter(
            (tx) =>
              (tx.type === 'expense' || tx.isRefund) &&
              !(hideAmounts && isSavingsEntry(tx, categoriesById, savingsIds))
          )
        );
        setLoadedScope(scope);
        setLoaded(true);
      },
      (e) => {
        if (active) setError(errorMessage(e));
      }
    );
    return () => {
      active = false;
    };
  }, [
    scope,
    categoryId,
    periodMonth,
    currency,
    hideAmounts,
    categoriesById,
    savingsIds,
    progress.spentMinor,
    retry,
  ]);
  const visibleEntries = entries.filter(
    (tx) => !(hideAmounts && isSavingsEntry(tx, categoriesById, savingsIds))
  );
  const today = toLocalIsoDate(new Date());
  const pace = periodMonth === today.slice(0, 7) ? budgetPace(progress.percentUsed / 100, today) : null;
  return (
    <SheetFlow>
      <ModalSheet
        flowPage
        visible={!editing}
        title="Budget overview"
        onClose={onClose}
        footer={<PrimaryButton title="Edit limit" variant="secondary" onPress={() => setEditing(true)} />}
      >
        <BudgetHero
          hue={progress.categoryColor}
          icon={progress.categoryIcon}
          title={categorySentence(progress.categoryName, progress.parentName)}
          kicker={`${
            progress.overBudget
              ? 'Over limit'
              : periodMonth === today.slice(0, 7)
                ? 'Remaining this month'
                : 'Remaining for this month'
          } · ${shortMonthYear(`${periodMonth}-01`)}`}
          remaining={formatMoney(Math.abs(progress.remainingMinor), currency)}
          over={progress.overBudget}
          pct={Math.min(100, Math.max(0, progress.percentUsed))}
          tone={progress.overBudget ? 'over' : pace?.state === 'ahead' ? 'near' : 'ok'}
          marker={pace ? pace.expectedFraction * 100 : undefined}
          animKey={`budget-detail:${progress.budget.id}`}
          spent={formatMoney(progress.spentMinor, currency)}
          limit={formatMoney(progress.effectiveLimitMinor, currency)}
          status={`${progress.overBudget ? 'Over budget' : pace ? BUDGET_PACE_LABEL[pace.state] : 'Monthly budget'}${
            progress.budget.rollover ? ' · Rolls over' : ''
          }`}
        />
        <View style={styles.headingRow}>
          <Text style={styles.heading}>Recent entries</Text>
          {loaded && loadedScope === scope && visibleEntries.length > 0 && (
            <Text style={styles.count}>{visibleEntries.length} this month</Text>
          )}
        </View>
        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.caption}>Couldn’t load recent entries: {error}</Text>
            <PrimaryButton title="Retry" compact variant="secondary" onPress={() => setRetry((v) => v + 1)} />
          </View>
        ) : !loaded || loadedScope !== scope ? (
          <Text style={styles.caption}>Loading entries…</Text>
        ) : visibleEntries.length === 0 ? (
          <Text style={styles.caption}>No visible spending entries this month.</Text>
        ) : (
          <View style={styles.entries}>
            {visibleEntries.map((tx, index) => (
              <RecentTransactionRow
                key={tx.id}
                tx={tx}
                category={tx.categoryId ? categoriesById.get(tx.categoryId) : undefined}
                parentName={parentNameOf(tx.categoryId, categoriesById)}
                accountName={accounts.find((a) => a.id === tx.accountId)?.name}
                toAccountName={undefined}
                divider={index > 0}
                omitCategory
                dense
                currency={currency}
              />
            ))}
          </View>
        )}
      </ModalSheet>
      {editing && (
        <AddBudgetModal
          visible
          editing={progress}
          categories={categories}
          backLabel="Back to budget overview"
          onClose={() => setEditing(false)}
          onSaved={async () => {
            setEditing(false);
            await onChanged();
          }}
        />
      )}
    </SheetFlow>
  );
}
const styles = StyleSheet.create({
  errorBox: { paddingVertical: 4, gap: 12, marginBottom: 10 },
  caption: { fontFamily: theme.font.body, fontSize: 13, lineHeight: 19, color: theme.colors.textSecondary },
  headingRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: 8,
    marginTop: 6,
    marginBottom: 8,
    marginHorizontal: 2,
  },
  heading: { fontFamily: theme.font.roundedBold, fontSize: 14, color: theme.colors.textPrimary },
  count: { fontFamily: theme.font.body, fontSize: 12, color: theme.colors.textSecondary },
  entries: { borderRadius: 20, backgroundColor: theme.colors.surface, overflow: 'hidden' },
});
