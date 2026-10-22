import { useEffect, useMemo, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { Text } from '@/components/Text';
import { ModalSheet } from '@/components/ModalSheet';
import { SheetFlow } from '@/components/SheetFlow';
import { SheetCard } from '@/components/SheetCard';
import { PrimaryButton } from '@/components/PrimaryButton';
import { LimitMeter } from '@/components/LimitMeter';
import { RecentTransactionRow } from '@/features/home/RecentTransactionRow';
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
import { longMonthYear } from '@/lib/dateLabels';
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
        <SheetCard
          hue={progress.categoryColor}
          icon={progress.categoryIcon}
          title={categorySentence(progress.categoryName, progress.parentName)}
          kicker={
            progress.overBudget
              ? 'Over limit'
              : periodMonth === today.slice(0, 7)
                ? 'Remaining this month'
                : 'Remaining for this month'
          }
          amount={formatMoney(Math.abs(progress.remainingMinor), currency)}
          meta={longMonthYear(`${periodMonth}-01`)}
        />
        <View style={styles.summary}>
          <View style={styles.figures}>
            <View style={styles.figure}>
              <Text style={styles.caption}>Spent</Text>
              <Text style={styles.value}>{formatMoney(progress.spentMinor, currency)}</Text>
            </View>
            <View style={styles.figure}>
              <Text style={styles.caption}>Available limit</Text>
              <Text style={styles.value}>{formatMoney(progress.effectiveLimitMinor, currency)}</Text>
            </View>
          </View>
          <LimitMeter
            pct={Math.min(100, Math.max(0, progress.percentUsed))}
            tone={progress.overBudget ? 'over' : pace?.state === 'ahead' ? 'near' : 'ok'}
            marker={pace ? pace.expectedFraction * 100 : undefined}
            animKey={`budget-detail:${progress.budget.id}`}
          />
          <Text style={styles.caption}>
            {progress.overBudget ? 'Over budget' : pace ? BUDGET_PACE_LABEL[pace.state] : 'Monthly budget'} ·{' '}
            {progress.budget.rollover ? 'Unspent money rolls over' : 'No rollover'}
          </Text>
        </View>
        <Text style={styles.heading}>Recent entries</Text>
        {error ? (
          <View style={styles.summary}>
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
  summary: {
    paddingVertical: 14,
    gap: 12,
    borderRadius: 22,
    backgroundColor: theme.colors.surface,
    marginBottom: 12,
  },
  figures: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
  figure: { flexGrow: 1, flexBasis: 120, gap: 4 },
  caption: { fontFamily: theme.font.body, fontSize: 13, lineHeight: 19, color: theme.colors.textSecondary },
  value: {
    fontFamily: theme.font.bodyBold,
    fontSize: 15,
    fontVariant: ['tabular-nums'],
    color: theme.colors.textPrimary,
  },
  heading: {
    fontFamily: theme.font.roundedBold,
    fontSize: 15,
    color: theme.colors.textPrimary,
    marginVertical: 10,
  },
  entries: { borderRadius: 22, backgroundColor: theme.colors.surface, overflow: 'hidden' },
});
