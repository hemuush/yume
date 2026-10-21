import { useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { getGoalReservationSummary, GoalReservationSummary } from '@/db/goalReservations';
import { Account } from '@/types';
import { Text } from '@/components/Text';
import { PrimaryButton } from '@/components/PrimaryButton';
import { formatMaskableMoney } from '@/lib/money';
import { usePrivacy } from '@/theme/PrivacyContext';
import { theme } from '@/constants/theme';
import { InsightHeader, InsightStat, InsightRow, insight } from '@/components/InsightCard';

/** Account-level earmarks; totals include archived and completed goals. */
export function AccountReservations({ account, onNavigate }: { account: Account; onNavigate: () => void }) {
  const [summary, setSummary] = useState<GoalReservationSummary | null>(null);
  const [failed, setFailed] = useState(false);
  const [retry, setRetry] = useState(0);
  const { hideAmounts } = usePrivacy();
  useEffect(() => {
    let live = true;
    setSummary(null);
    setFailed(false);
    getGoalReservationSummary(account.id)
      .then((s) => {
        if (live) setSummary(s);
      })
      .catch(() => {
        if (live) setFailed(true);
      });
    return () => {
      live = false;
    };
  }, [account.id, account.currentBalanceMinor, retry]);
  const money = (minor: number) =>
    formatMaskableMoney(minor, { currency: account.currency, masked: hideAmounts });
  if (failed)
    return (
      <View style={styles.card}>
        <Text style={styles.hint}>Couldn't load goal reservations.</Text>
        <PrimaryButton
          compact
          variant="secondary"
          title="Retry reservations"
          onPress={() => setRetry((n) => n + 1)}
        />
      </View>
    );
  if (!summary || summary.goals.length === 0) return null;
  return (
    <View style={styles.card}>
      <InsightHeader title="Kept for your goals" subtitle="Money stays in this account" icon="lock" />
      <View style={insight.facts}>
        <InsightStat label="Reserved" value={money(summary.reservedMinor)} />
        <InsightStat label="Available to reserve" value={money(summary.availableMinor)} />
      </View>
      {summary.shortfallMinor > 0 && (
        <Text style={styles.warning}>
          Balance is {money(summary.shortfallMinor)} below reservations. Release or reassign money to review
          your plan.
        </Text>
      )}
      {summary.goals.map((goal) => (
        <InsightRow
          key={goal.id}
          label={goal.name}
          detail={goal.archived ? 'Archived · still reserved' : 'Reserved for goal'}
          value={money(goal.reservedMinor)}
        />
      ))}
      <PrimaryButton
        compact
        variant="secondary"
        title="Manage goals"
        onPress={() => {
          onNavigate();
          router.push('/savings-goals');
        }}
      />
    </View>
  );
}
const styles = StyleSheet.create({
  card: { padding: 14, gap: 8, marginBottom: 14, borderRadius: 18, backgroundColor: theme.colors.surfaceAlt },
  hint: { fontFamily: theme.font.body, fontSize: 12, color: theme.colors.textMuted },
  warning: { fontFamily: theme.font.bodyMedium, fontSize: 13, color: theme.colors.expenseText },
});
