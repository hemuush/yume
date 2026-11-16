import { useEffect, useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { router } from 'expo-router';
import { ModalSheet } from '@/components/ModalSheet';
import { Text } from '@/components/Text';
import { theme } from '@/constants/theme';
import { withPressed } from '@/lib/pressed';
import { AddBudgetModal } from '@/features/budgets/AddBudgetModal';
import { BudgetDetailModal } from '@/features/budgets/BudgetDetailModal';
import { budgetCategories } from '@/features/budgets/budgetCategories';
import { AddGoalModal } from '@/features/goals/AddGoalModal';
import { GoalOverviewModal } from '@/features/goals/GoalOverviewModal';
import { AddLoanModal } from '@/features/loans/AddLoanModal';
import { LoanComparison } from '@/features/loans/LoanComparison';
import { LoanDetailModal } from '@/features/loans/LoanDetailModal';
import { PayInstallmentSheet } from '@/features/loans/PayInstallmentSheet';
import { loanHues } from '@/features/loans/loanIdentity';
import { PersonDetailModal } from '@/features/people/PersonDetailModal';
import { AddAccountModal } from '@/features/profile/AddAccountModal';
import { RuleModal } from '@/features/recurring/RuleModal';
import { TransactionDetailModal } from '@/features/transactions/TransactionDetailModal';
import type { PlanData } from './planData';
import { usePlanSheets, type PlanDetailKind, type PlanSheets as PlanSheetsStore } from './planSheetsStore';
import { themedStyles } from '@/theme/themedStyles';

/** The rows of "Add to your plan". */
const NEW_ROWS = [
  ['new-rule', 'Add recurring', 'Bills, subscriptions or income', 'repeat'],
  ['new-loan', 'Add loan', 'Track borrowing or lending', 'plus'],
  ['new-budget', 'Add budget', 'Set a category spending limit', 'pie-chart'],
  ['new-goal', 'Add goal', 'Save for something important', 'flag'],
] as const satisfies readonly (readonly [PlanDetailKind, string, string, string])[];

/**
 * The sheets Plan opens: an item's detail (a loan, budget, person, goal or recurring rule), the forms to add one, an
 * entry opened from the pending refunds, an installment being paid, the loan comparison and "Add to your plan". Which is
 * open lives in `sheets`, so the page behind does not redraw when one opens or closes. `data` is null while the page's
 * figures are for the other privacy setting: nothing that shows them opens then.
 */
export function PlanSheets({
  sheets,
  data,
  hideAmounts,
  reload,
}: {
  sheets: PlanSheetsStore;
  data: PlanData | null;
  hideAmounts: boolean;
  /** Reloads Plan in place after something was saved or deleted in a sheet. */
  reload: () => Promise<void>;
}) {
  const { detail, refundTx, paying, creationMenu, comparisonOpen } = usePlanSheets(sheets);
  const refresh = () => void reload();
  const borrowed = useMemo(
    () => data?.loans.rows.filter((loan) => loan.direction === 'borrowed') ?? [],
    [data]
  );
  const hues = useMemo(() => loanHues(data?.loanDetails ?? []), [data?.loanDetails]);
  const selectedLoan =
    detail?.kind === 'loan'
      ? data?.loanDetails.find((l) => l.id === detail.id && l.status !== 'closed')
      : undefined;
  const selectedBudget =
    detail?.kind === 'budget' ? data?.budgetDetails.find((b) => b.budget.id === detail.id) : undefined;
  const selectedPerson =
    detail?.kind === 'person' ? data?.personDetails.find((p) => p.id === detail.id) : undefined;
  const selectedRule =
    detail?.kind === 'rule' ? data?.ruleDetails.find((r) => r.id === detail.id) : undefined;
  const selectedGoal =
    detail?.kind === 'goal' ? data?.goals.find((g) => g.id === detail.id && !g.archived) : undefined;
  // A goal or a rule that is gone (deleted elsewhere, or in its own sheet) takes its sheet with it.
  useEffect(() => {
    if (data && ((detail?.kind === 'goal' && !selectedGoal) || (detail?.kind === 'rule' && !selectedRule))) {
      sheets.closeDetail();
    }
  }, [detail, data, selectedGoal, selectedRule, sheets]);

  return (
    <>
      {data && (
        <LoanComparison
          refreshToken={data}
          visible={comparisonOpen}
          hidden={hideAmounts}
          currency={data.currency}
          loans={borrowed}
          onClose={sheets.closeComparison}
          onOpenLoan={(id) => {
            sheets.closeComparison();
            sheets.openDetail('loan', id);
          }}
        />
      )}
      {creationMenu && data && (
        <ModalSheet
          visible
          title="Add to your plan"
          subtitle="Give your next commitment a place."
          onClose={sheets.closeMenu}
        >
          {NEW_ROWS.map(([kind, label, description, icon]) => (
            <Pressable
              key={kind}
              accessibilityRole="button"
              accessibilityLabel={label}
              onPress={() => sheets.pickNew(kind)}
              style={withPressed(styles.menuRow)}
            >
              <Feather name={icon} size={20} color={theme.colors.link} />
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={styles.menuTitle}>{label}</Text>
                <Text style={styles.menuDescription}>{description}</Text>
              </View>
              <Feather name="chevron-right" size={16} color={theme.colors.textMuted} />
            </Pressable>
          ))}
        </ModalSheet>
      )}
      {detail?.kind === 'new-account' && data && (
        <AddAccountModal
          visible
          onClose={sheets.closeDetail}
          onCreated={() => {
            sheets.closeDetail();
            refresh();
          }}
        />
      )}
      {detail?.kind === 'new-loan' && data && (
        <AddLoanModal
          visible
          onClose={sheets.closeDetail}
          onCreated={() => {
            sheets.closeDetail();
            refresh();
          }}
        />
      )}
      {selectedLoan && data && (
        <LoanDetailModal
          key={selectedLoan.id}
          loan={selectedLoan}
          hue={hues[selectedLoan.id]}
          onClose={sheets.closeDetail}
          onChanged={refresh}
        />
      )}
      {selectedBudget && data && (
        <BudgetDetailModal
          key={selectedBudget.budget.id}
          progress={selectedBudget}
          accounts={data.accounts}
          categories={data.categories}
          currency={data.currency}
          onClose={sheets.closeDetail}
          onChanged={refresh}
        />
      )}
      {selectedPerson && (
        <PersonDetailModal
          key={selectedPerson.id}
          person={selectedPerson}
          initialTab="history"
          onClose={sheets.closeDetail}
          onChanged={refresh}
        />
      )}
      {selectedGoal && data && (
        <GoalOverviewModal
          key={selectedGoal.id}
          goal={selectedGoal}
          accounts={data.accounts}
          onClose={sheets.closeDetail}
          onChanged={refresh}
          onMoveMoney={(accountId) => {
            sheets.closeDetail();
            router.push({
              pathname: '/add-transaction',
              params: { type: 'transfer', toAccountId: accountId },
            });
          }}
        />
      )}
      {detail?.kind === 'new-goal' && data && (
        <AddGoalModal
          visible
          accounts={data.accounts}
          onClose={sheets.closeDetail}
          onCreated={() => {
            sheets.closeDetail();
            refresh();
          }}
        />
      )}
      {detail?.kind === 'new-budget' && data && (
        <AddBudgetModal
          visible
          editing={null}
          categories={budgetCategories(data.categories, hideAmounts)}
          budgetedCategoryIds={new Set(data.budgetDetails.map((b) => b.budget.categoryId))}
          onClose={sheets.closeDetail}
          onSaved={() => {
            sheets.closeDetail();
            refresh();
          }}
        />
      )}
      {(selectedRule || detail?.kind === 'new-rule') && data && (
        <RuleModal
          key={selectedRule?.id ?? 'new-rule'}
          visible
          editing={selectedRule ?? null}
          accounts={data.accounts}
          categories={data.categories}
          onClose={sheets.closeDetail}
          onSaved={() => {
            sheets.closeDetail();
            refresh();
          }}
          onDeleted={() => {
            sheets.closeDetail();
            refresh();
          }}
        />
      )}
      {refundTx && data && (
        <TransactionDetailModal
          key={refundTx.id}
          tx={refundTx}
          accounts={data.accounts}
          categories={data.categories}
          onClose={sheets.closeRefund}
          onEdit={(tx) => {
            sheets.closeRefund();
            router.push({ pathname: '/add-transaction', params: { id: tx.id } });
          }}
          onChanged={() => {
            sheets.closeRefund();
            refresh();
          }}
        />
      )}
      {paying && (
        <PayInstallmentSheet
          installment={paying.installment}
          direction={paying.direction}
          account={paying.account}
          categoryId={paying.categoryId}
          linkedAccountMissing={paying.linkedAccountMissing}
          balanceMinor={paying.account ? data?.balances[paying.account.id] : undefined}
          onClose={sheets.closePaying}
          onPaid={reload}
        />
      )}
    </>
  );
}

const styles = themedStyles(() =>
  StyleSheet.create({
    menuRow: { minHeight: 68, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 14 },
    menuTitle: { fontFamily: theme.font.bodyMedium, fontSize: 15, color: theme.colors.textPrimary },
    menuDescription: { fontFamily: theme.font.body, fontSize: 12, color: theme.colors.textSecondary },
  })
);
