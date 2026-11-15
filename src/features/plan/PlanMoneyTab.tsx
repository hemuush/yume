import { memo, useCallback, useMemo } from 'react';
import { router } from 'expo-router';
import { Section } from '@/components/Section';
import { BudgetJars } from './BudgetJars';
import { InvestmentsCard } from './InvestmentsCard';
import { MonthlyPlanCheck } from './MonthlyPlanCheck';
import type { PlanActions } from './planActions';
import type { PlanData } from './planData';
import { GoalsStrip, WhatIfCard } from './PlanGoals';

/**
 * Plan's "Money plan": the check of the month's commitments, budgets, goals, and investments with the what-if. It
 * compares its props by identity, so it is drawn again only when what it shows, or the reload that refreshes the
 * check (`refreshToken`), changes.
 */
// The sections compare their props by identity; the tab hands them values that keep theirs until what is in them changes.
const Check = memo(MonthlyPlanCheck);
const Jars = memo(BudgetJars);
const Goals = memo(GoalsStrip);
const Investments = memo(InvestmentsCard);

export const PlanMoneyTab = memo(function PlanMoneyTab({
  data,
  refreshToken,
  hideAmounts,
  actions,
}: {
  data: PlanData;
  /** Changes with each load of the page: the check reads its own data again. */
  refreshToken: object;
  hideAmounts: boolean;
  actions: PlanActions;
}) {
  const { open, openDetail } = actions;
  const checkInput = useMemo(
    () => ({
      categories: data.categories,
      accounts: data.accounts,
      rules: data.ruleDetails,
      budgets: data.budgetDetails.map((b) => ({
        categoryId: b.budget.categoryId,
        limitMinor: b.effectiveLimitMinor,
      })),
      goals: data.goals,
      loans: data.loans.rows,
      today: data.today,
    }),
    [data]
  );
  const openBudgets = useCallback(() => open('/budgets'), [open]);
  const openBudget = useCallback((id: string) => openDetail('budget', id), [openDetail]);
  const addBudget = useCallback(() => openDetail('new-budget', ''), [openDetail]);
  const openGoals = useCallback(() => open('/savings-goals'), [open]);
  const openGoal = useCallback((id: string) => openDetail('goal', id), [openDetail]);
  const addGoal = useCallback(() => openDetail('new-goal', ''), [openDetail]);
  const openInvestments = useCallback(() => open('/investments'), [open]);
  const { whatIf } = data;
  const openWhatIf = useCallback(
    (cut: number) =>
      whatIf
        ? router.push({
            pathname: '/whatif',
            params: { category: whatIf.categoryId, cut: String(cut) },
          })
        : open('/whatif'),
    [whatIf, open]
  );
  const whatIfTile = useMemo(
    () => <WhatIfCard key="what-if" whatIf={whatIf} onOpen={openWhatIf} />,
    [whatIf, openWhatIf]
  );
  return (
    <>
      <Check refreshToken={refreshToken} currency={data.currency} hidden={hideAmounts} input={checkInput} />
      <Section compact first title="Budgets" actionLabel="Manage budgets" onSeeAll={openBudgets}>
        <Jars
          hideAdd
          summary={data.budgets}
          onOpen={openBudgets}
          onBudget={openBudget}
          onAdd={addBudget}
          limit={data.budgets.rows.length + 1}
        />
      </Section>
      <Section compact title="Goals" actionLabel="Manage goals" onSeeAll={openGoals}>
        <Goals
          hideAdd
          goals={data.goals}
          savingsAccounts={data.savingsAccounts}
          onOpen={openGoals}
          onGoal={openGoal}
          onAdd={addGoal}
          limit={data.goals.length + 1}
        />
      </Section>
      <Section compact title="More">
        <Investments portfolio={data.investments} onOpen={openInvestments} extraTile={whatIfTile} />
      </Section>
    </>
  );
});
