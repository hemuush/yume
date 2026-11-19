import { memo } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { Text } from '@/components/Text';
import { theme } from '@/constants/theme';
import { withPressed } from '@/lib/pressed';
import { themedStyles } from '@/theme/themedStyles';
import LoansWorkspace from '@/features/loans/LoansWorkspace';
import type { PlanActions } from './planActions';
import type { PlanData } from './planData';

/** Debt keeps the full loan workspace inside Plan, including closed loans and payment actions. */
export const PlanDebtTab = memo(function PlanDebtTab({
  data,
  actions,
  refreshToken,
  reload,
}: {
  data: PlanData;
  actions: PlanActions;
  refreshToken: object;
  reload: () => Promise<void>;
}) {
  const canCompare = data.loans.rows.filter((loan) => loan.direction === 'borrowed').length >= 2;
  return (
    <LoansWorkspace
      embedded
      refreshToken={refreshToken}
      onChanged={reload}
      payoffAction={
        canCompare && (
          <Pressable
            accessibilityRole="button"
            onPress={actions.openComparison}
            style={withPressed(styles.compare)}
          >
            <Feather name="sliders" size={15} color={theme.colors.link} />
            <Text style={styles.label}>Compare an extra payment</Text>
          </Pressable>
        )
      }
    />
  );
});

const styles = themedStyles(() =>
  StyleSheet.create({
    compare: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 8 },
    label: { flexShrink: 1, fontFamily: theme.font.bodyMedium, fontSize: 13, color: theme.colors.link },
  })
);
