import { View, StyleSheet } from 'react-native';
import { Text } from '@/components/Text';
import { PrimaryButton } from '@/components/PrimaryButton';
import { PaceBar } from '@/components/Frost';
import { theme } from '@/constants/theme';
import { EYEBROW } from '@/constants/textStyles';
import { cardUsage, HIGH_USE_PCT } from '@/lib/cardUsage';
import { dayMonth } from '@/lib/dateLabels';
import type { AccountCardCycle } from '@/db/cardCycles';
import type { Account } from '@/types';

/** How much of a credit card's limit is used, as a bar and one line; nothing for a card with no limit. */
export function CardUsageBar({ account, money }: { account: Account; money: (minor: number) => string }) {
  const usage = cardUsage(account);
  if (!usage) return null;
  const used = Math.round(usage.pct);
  return (
    <View style={styles.usage}>
      <PaceBar
        animKey={`card:${account.id}`}
        pct={Math.min(100, usage.pct)}
        color={
          usage.availableMinor < 0
            ? theme.colors.expense
            : usage.high
              ? theme.colors.slice.due
              : theme.colors.slice.saved
        }
        accessibilityLabel={`${used} percent of the credit limit used`}
      />
      <Text style={styles.usageLine}>
        <Text style={styles.usageBold}>{used}%</Text> of {money(usage.limitMinor)} used ·{' '}
        {usage.availableMinor < 0
          ? `${money(-usage.availableMinor)} over the limit`
          : `${money(usage.availableMinor)} available`}
      </Text>
      {usage.high && (
        <Text style={styles.note}>
          Keeping use under about {HIGH_USE_PCT}% of the limit is a common guide for a healthy credit score.
        </Text>
      )}
    </View>
  );
}

/** One line of a card's bill: what it is on the left, the amount on the right. */
function BillLine({
  label,
  value,
  strong,
  valueColor,
  divider,
}: {
  label: string;
  value: string;
  strong?: boolean;
  valueColor?: string;
  /** A hairline above: every line but the first. */
  divider?: boolean;
}) {
  return (
    <View style={[styles.billLine, divider && styles.billDivider]}>
      <Text style={[styles.billLabel, strong && styles.billLabelStrong]}>{label}</Text>
      <Text style={[styles.billValue, valueColor ? { color: valueColor } : null]}>{value}</Text>
    </View>
  );
}

/**
 * A credit card's bill: this cycle, the last statement, the minimum due when the card has one, what was paid
 * and what is left, with Pay bill and Pay minimum and a quick way to add a card charge. The minimum button
 * shows only while some of it is unpaid and it is less than the whole bill.
 */
export function CardBill({
  account,
  cycle,
  failed,
  money,
  feesCategoryId,
  onPayBill,
  onAddCharge,
}: {
  account: Account;
  /** The card's bill, null when it has no statement and due days or has not loaded. */
  cycle: AccountCardCycle | null;
  /** The bill could not be read. */
  failed: boolean;
  money: (minor: number) => string;
  /** The Fees & Charges category, when it exists, so a charge opens with it chosen. */
  feesCategoryId: string | null;
  onPayBill?: (account: Account, amountMinor: number) => void;
  onAddCharge?: (account: Account, categoryId: string | null) => void;
}) {
  const payMinimum =
    cycle != null &&
    cycle.leftToPayMinor > 0 &&
    cycle.leftMinimumMinor != null &&
    cycle.leftMinimumMinor > 0 &&
    cycle.leftMinimumMinor < cycle.leftToPayMinor
      ? cycle.leftMinimumMinor
      : null;
  return (
    <>
      {failed && <Text style={styles.note}>Couldn't load this card's bill.</Text>}
      {cycle && (
        <>
          <Text style={styles.label}>Bill</Text>
          <View style={styles.lines}>
            <BillLine
              label={`This cycle · ${dayMonth(cycle.cycleStart)} – ${dayMonth(cycle.cycleEnd)}`}
              value={money(cycle.spentThisCycleMinor)}
            />
            <BillLine
              divider
              label={`Last statement · ${dayMonth(cycle.statementDate)}`}
              value={money(cycle.statementMinor)}
            />
            {cycle.minimumMinor != null && (
              <BillLine divider label="Minimum due" value={money(cycle.minimumMinor)} />
            )}
            <BillLine
              divider
              label="Paid since"
              value={money(cycle.paidSinceMinor)}
              valueColor={theme.colors.incomeText}
            />
            <BillLine
              divider
              label={
                cycle.leftToPayMinor === 0
                  ? 'Paid in full'
                  : cycle.daysUntilDue < 0
                    ? `Left to pay · was due ${dayMonth(cycle.dueDate)}`
                    : `Left to pay by ${dayMonth(cycle.dueDate)}`
              }
              value={money(cycle.leftToPayMinor)}
              strong
              valueColor={
                cycle.daysUntilDue < 0 && cycle.leftToPayMinor > 0 ? theme.colors.expenseText : undefined
              }
            />
          </View>
          {cycle.leftToPayMinor > 0 && onPayBill && (
            <PrimaryButton
              title={`Pay bill · ${money(cycle.leftToPayMinor)}`}
              variant="secondary"
              onPress={() => onPayBill(account, cycle.leftToPayMinor)}
              style={styles.action}
            />
          )}
          {payMinimum != null && onPayBill && (
            <>
              <PrimaryButton
                title={`Pay minimum · ${money(payMinimum)}`}
                variant="secondary"
                onPress={() => onPayBill(account, payMinimum)}
                style={styles.action}
              />
              <Text style={styles.note}>
                Paying only the minimum avoids a late fee, but interest starts on the rest and the
                interest-free days are lost.
              </Text>
            </>
          )}
        </>
      )}
      {onAddCharge && (
        <PrimaryButton
          title="Add a card charge"
          variant="secondary"
          onPress={() => onAddCharge(account, feesCategoryId)}
          style={styles.action}
        />
      )}
    </>
  );
}

const styles = StyleSheet.create({
  label: EYEBROW,
  usage: { gap: 6, marginTop: 4 },
  usageLine: { fontFamily: theme.font.body, fontSize: 13, color: theme.colors.textSecondary },
  usageBold: { fontFamily: theme.font.bodyBold, color: theme.colors.textPrimary },
  note: { fontFamily: theme.font.body, fontSize: 13, color: theme.colors.textMuted, marginTop: 8 },
  action: { marginTop: 10 },
  lines: {
    marginTop: 8,
    marginHorizontal: -4,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.xl2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.borderSoft,
    overflow: 'hidden',
  },
  billLine: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  billDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.colors.borderSoft },
  billLabel: {
    flexGrow: 1,
    flexBasis: 140,
    fontFamily: theme.font.body,
    fontSize: 13,
    color: theme.colors.textSecondary,
  },
  billLabelStrong: { fontFamily: theme.font.bodyBold, color: theme.colors.textPrimary },
  billValue: {
    fontFamily: theme.font.bodyMedium,
    fontSize: 13,
    fontVariant: ['tabular-nums'],
    color: theme.colors.textPrimary,
  },
});
