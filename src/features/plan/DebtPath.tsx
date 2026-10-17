import { View, Pressable, StyleSheet } from 'react-native';
import { Text } from '@/components/Text';
import { Glass } from '@/components/Glass';
import { cardSurface } from '@/components/CardSurface';
import { formatMoney } from '@/lib/money';
import { formatRatioPct } from '@/lib/format';
import { withPressed } from '@/lib/pressed';
import { shortMonthYear } from '@/lib/dateLabels';
import { LoansSummary } from './planOverview';
import { Kicker, PlanChip } from './PlanTiles';
import { styles } from './plan.styles';

import Feather from '@expo/vector-icons/Feather';
import { theme } from '@/constants/theme';

/** A compact debt overview with direct loan shortcuts and a link to the full collection. */
export function DebtPath({
  loans,
  today,
  onOpen,
  onLoan,
}: {
  loans: LoansSummary;
  today: string;
  onOpen: () => void;
  onLoan?: (id: string) => void;
}) {
  const borrowed = loans.rows.filter((r) => r.direction === 'borrowed');
  if (borrowed.length === 0) {
    return (
      <Pressable
        onPress={onOpen}
        style={withPressed()}
        accessibilityRole="button"
        accessibilityLabel="Track an EMI. Open loans"
      >
        <Glass style={[styles.card, cardSurface.neutral]}>
          <Kicker icon="flag">No loans yet</Kicker>
          <Text style={styles.title}>Track an EMI</Text>
          <Text style={styles.sub}>
            A home or car loan. You&rsquo;ll see the month you&rsquo;re debt-free.
          </Text>
          {loans.lentLeftMinor > 0 && (
            <View style={styles.chips}>
              <PlanChip icon="arrow-up-right">{formatMoney(loans.lentLeftMinor)} you lent out</PlanChip>
            </View>
          )}
        </Glass>
      </Pressable>
    );
  }

  // A debt-free month is only claimed when every loan has an end date and it's still ahead.
  const knownEnd =
    loans.debtFreeDate != null && loans.debtFreeDate > today && borrowed.every((r) => r.endDate != null)
      ? loans.debtFreeDate
      : null;
  const largest = borrowed.reduce<(typeof borrowed)[number] | null>(
    (top, r) => (top == null || r.leftMinor > top.leftMinor ? r : top),
    null
  );
  const timeline = knownEnd ? `Debt-free ${shortMonthYear(knownEnd)}` : 'Debt-free date unknown';

  return (
    <View>
      <Glass style={[styles.card, cardSurface.debt]}>
        <View style={styles.head}>
          <View style={{ flexShrink: 1, gap: 4 }}>
            <Text style={styles.pathNote}>Principal left</Text>
            <Text style={styles.pathValue} numberOfLines={1} adjustsFontSizeToFit>
              {formatMoney(loans.debtLeftMinor)}
            </Text>
          </View>
          <Text style={styles.pathNote}>{formatRatioPct(loans.paidFraction)} repaid</Text>
        </View>
        <View
          style={local.track}
          accessibilityRole="progressbar"
          accessibilityLabel="Principal repaid"
          accessibilityValue={{ min: 0, max: 100, now: Math.round(loans.paidFraction * 100) }}
        >
          <View style={[local.fill, { width: `${Math.min(100, Math.max(0, loans.paidFraction * 100))}%` }]} />
        </View>
        <Text style={styles.pathNote}>{timeline}</Text>
        {loans.lentLeftMinor > 0 && (
          <View style={styles.chips}>
            <PlanChip icon="arrow-up-right">{formatMoney(loans.lentLeftMinor)} you lent out</PlanChip>
          </View>
        )}
        {onLoan && largest && (
          <Pressable
            onPress={() => onLoan(largest.id)}
            style={withPressed(local.loanRow)}
            accessibilityRole="button"
            accessibilityLabel={`Open loan details: ${largest.name}`}
          >
            <Text style={[local.loanName, local.loanCopy]} numberOfLines={1}>
              {largest.name}
            </Text>
            <Text style={local.loanName}>{formatMoney(largest.leftMinor)}</Text>
            <Feather name="chevron-right" size={16} color={theme.colors.textMuted} />
          </Pressable>
        )}
        <Pressable
          onPress={onOpen}
          style={withPressed(local.link)}
          accessibilityRole="button"
          accessibilityLabel="Open loans"
        >
          <Text style={local.linkText}>View loans · {borrowed.length} active</Text>
          <Feather name="chevron-right" size={17} color={theme.colors.link} />
        </Pressable>
      </Glass>
    </View>
  );
}

const local = StyleSheet.create({
  loanRow: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.borderSoft,
    paddingVertical: 8,
  },
  loanCopy: { flex: 1 },
  loanName: {
    fontFamily: theme.font.bodyMedium,
    fontSize: 13,
    color: theme.colors.textPrimary,
    fontVariant: ['tabular-nums'],
  },
  track: { height: 6, borderRadius: 3, backgroundColor: theme.colors.borderSoft, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 3, backgroundColor: theme.colors.incomeText },
  link: {
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.borderSoft,
    paddingTop: 6,
  },
  linkText: { flexShrink: 1, fontFamily: theme.font.bodyBold, fontSize: 13, color: theme.colors.link },
});
