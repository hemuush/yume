import { View, Pressable, StyleSheet } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { Text } from '@/components/Text';
import { SCREEN } from '@/components/screenStyles';
import { formatMoney } from '@/lib/money';
import { formatRatioPct } from '@/lib/format';
import { withPressed, withPressedTint } from '@/lib/pressed';
import { shortMonthYear } from '@/lib/dateLabels';
import { loanBarTone } from '@/features/loans/loanIdentity';
import { useAccent } from '@/theme/AccentContext';
import { themeInk } from '@/theme/interactionColors';
import { LoansSummary } from './planOverview';
import { Kicker, PlanChip } from './PlanTiles';
import { styles } from './plan.styles';

import { PlanListAdd } from './PlanSummaryRow';
import { theme } from '@/constants/theme';
import { themedStyles } from '@/theme/themedStyles';

/**
 * The Debt tab's summary, the same flat card as the other screens: when you are debt-free, what is left and
 * the share repaid, one bar split by loan in each loan's own colour, money you lent out, and a row to compare
 * an extra payment. Tapping the top opens Loans.
 */
export function DebtPath({
  loans,
  today,
  hues = {},
  onOpen,
  onAdd,
  onCompare,
}: {
  loans: LoansSummary;
  today: string;
  /** Each loan's identity colour (loanHues), shared with the tiles and with Loans. */
  hues?: Record<string, string>;
  onOpen: () => void;
  onAdd?: () => void;
  /** Opens the extra-payment comparison; the row shows only when there is something to compare. */
  onCompare?: () => void;
}) {
  const { accent } = useAccent();
  const borrowed = loans.rows.filter((r) => r.direction === 'borrowed');
  if (borrowed.length === 0) {
    return (
      <View style={[local.card, local.emptyCard]}>
        <Pressable
          onPress={onOpen}
          style={withPressed()}
          accessibilityRole="button"
          accessibilityLabel={`${loans.lentLeftMinor > 0 ? 'Review repayments' : 'Track an EMI'}. Open loans`}
        >
          <View style={local.summary}>
            <Kicker icon="flag">{loans.lentLeftMinor > 0 ? 'No borrowed loans' : 'No loans yet'}</Kicker>
            <Text style={styles.title}>{loans.lentLeftMinor > 0 ? 'Review repayments' : 'Track an EMI'}</Text>
            <Text style={styles.sub}>
              {loans.lentLeftMinor > 0
                ? 'Open Loans to review repayments on money you lent.'
                : 'A home or car loan. You’ll see the month you’re debt-free.'}
            </Text>
            {loans.lentLeftMinor > 0 && (
              <View style={styles.chips}>
                <PlanChip icon="arrow-up-right">{formatMoney(loans.lentLeftMinor)} you lent out</PlanChip>
              </View>
            )}
          </View>
        </Pressable>
        {onAdd && <PlanListAdd label="Add loan" onPress={onAdd} />}
      </View>
    );
  }

  // A debt-free month is only claimed when every loan has an end date and it's still ahead.
  const knownEnd =
    loans.debtFreeDate != null && loans.debtFreeDate > today && borrowed.every((r) => r.endDate != null)
      ? loans.debtFreeDate
      : null;
  const timeline = knownEnd ? `Debt-free ${shortMonthYear(knownEnd)}` : 'Debt-free date unknown';
  const shares = borrowed.filter((r) => r.leftMinor > 0);
  const ink = themeInk(accent);

  return (
    <View style={local.card}>
      <Pressable
        onPress={onOpen}
        style={withPressed(local.top)}
        accessibilityRole="button"
        accessibilityLabel={`Principal left ${formatMoney(loans.debtLeftMinor)}, ${formatRatioPct(loans.paidFraction)} repaid, ${timeline}. Open loans`}
      >
        <View style={local.head}>
          <View style={local.headMain}>
            <Text style={local.label}>Principal remaining</Text>
            <Text style={local.figure}>{formatMoney(loans.debtLeftMinor)} left</Text>
            <Text style={local.sideNote}>
              {formatRatioPct(loans.paidFraction)} repaid · {borrowed.length} loan
              {borrowed.length === 1 ? '' : 's'}
            </Text>
          </View>
          <View style={local.side}>
            <Text style={local.label}>Debt-free</Text>
            <Text style={local.sideMain}>{knownEnd ? shortMonthYear(knownEnd) : 'Date unknown'}</Text>
          </View>
        </View>
        {shares.length > 0 && (
          <View
            style={local.split}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          >
            {shares.map((r) => (
              <View
                key={r.id}
                style={[
                  local.segment,
                  {
                    flexGrow: r.leftMinor,
                    backgroundColor: loanBarTone(hues[r.id] ?? theme.colors.idGold),
                  },
                ]}
              />
            ))}
          </View>
        )}
        {loans.lentLeftMinor > 0 && (
          <View style={local.fact}>
            <Text style={local.factLabel}>Lent out</Text>
            <Text style={[local.factValue, { color: theme.colors.incomeText }]}>
              {formatMoney(loans.lentLeftMinor)}
            </Text>
          </View>
        )}
      </Pressable>
      {onCompare && (
        <Pressable
          onPress={onCompare}
          accessibilityRole="button"
          accessibilityLabel="Compare an extra payment"
          style={withPressedTint(accent, local.compare)}
        >
          <Text style={[local.compareText, { color: ink }]}>Compare an extra payment</Text>
          <Feather name="chevron-right" size={16} color={ink} />
        </Pressable>
      )}
      {onAdd && <PlanListAdd label="Add loan" onPress={onAdd} />}
    </View>
  );
}

const local = themedStyles(() =>
  StyleSheet.create({
    summary: { gap: 8, minHeight: 44 },
    card: {
      marginHorizontal: SCREEN.gutter,
      backgroundColor: theme.colors.home.surface,
      borderColor: theme.colors.home.edge,
      borderWidth: StyleSheet.hairlineWidth,
      borderRadius: 20,
    },
    emptyCard: { padding: SCREEN.cardPad },
    top: { paddingHorizontal: 14, paddingTop: 12, paddingBottom: 12, gap: 8 },
    head: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'flex-end',
      justifyContent: 'space-between',
      columnGap: 12,
      rowGap: 4,
    },
    headMain: { flexShrink: 1, minWidth: 0 },
    label: { fontFamily: theme.font.body, fontSize: 12, color: theme.colors.textSecondary },
    figure: {
      fontFamily: theme.font.bodyBold,
      fontSize: 24,
      lineHeight: 30,
      letterSpacing: -0.2,
      color: theme.colors.textPrimary,
    },
    side: { flexShrink: 1, alignItems: 'flex-end' },
    sideMain: {
      fontFamily: theme.font.bodyBold,
      fontSize: 13,
      fontVariant: ['tabular-nums'],
      color: theme.colors.textPrimary,
    },
    sideNote: { fontFamily: theme.font.body, fontSize: 11, color: theme.colors.textMuted },
    split: { flexDirection: 'row', gap: 3, height: 8, borderRadius: 4, overflow: 'hidden' },
    segment: { flexBasis: 0, minWidth: 6, height: 8, borderRadius: 4 },
    fact: { gap: 0 },
    factLabel: { fontFamily: theme.font.body, fontSize: 12, color: theme.colors.textSecondary },
    factValue: { fontFamily: theme.font.bodyMedium, fontSize: 15, fontVariant: ['tabular-nums'] },
    compare: {
      minHeight: 44,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 14,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: theme.colors.divider,
      borderBottomLeftRadius: theme.radius.xl2,
      borderBottomRightRadius: theme.radius.xl2,
    },
    compareText: { fontFamily: theme.font.bodyBold, fontSize: 13 },
  })
);
