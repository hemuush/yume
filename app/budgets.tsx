import { Redirect, useLocalSearchParams } from 'expo-router';

/** Keep existing links opening the same item inside Plan. */
export default function BudgetRedirect() {
  const { budget, add } = useLocalSearchParams<{ budget?: string; add?: string }>();
  return (
    <Redirect
      href={{
        pathname: '/(tabs)/plan',
        params: { tab: 'money', collection: 'budgets', budget, budgetAdd: add },
      }}
    />
  );
}
