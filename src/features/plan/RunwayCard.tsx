import { useState } from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { RunwayRibbon } from './RunwayRibbon';
import { ForecastDetails } from './ForecastDetails';
import { withPressed } from '@/lib/pressed';
import { PrimaryButton } from '@/components/PrimaryButton';
import { Text } from '@/components/Text';
import { theme } from '@/constants/theme';
import { formatMoney } from '@/lib/money';
import { dayMonth, weekdayDayMonth } from '@/lib/dateLabels';
import { DueSoon } from './planOverview';
import { Runway } from './runway';
import { noBreak } from '@/lib/keepTogether';
import { themedStyles } from '@/theme/themedStyles';

/**
 * Spending balance, scoped inflow/outflow and a compact forecast verdict. Without an account,
 * show scheduled outgoing and account setup instead of implying a balance.
 */
export function RunwayCard({
  dueSoon,
  runway,
  hasAccounts,
  days,
  onAddAccount,
  onViewPayments,
  onViewDay,
}: {
  dueSoon: DueSoon;
  runway: Runway;
  /** Whether any bank, cash or wallet account holds the starting balance. */
  hasAccounts: boolean;
  /** The window the runway covers. */
  days: number;
  onAddAccount?: () => void;
  onViewPayments?: () => void;
  onViewDay?: (date: string) => void;
}) {
  const [details, setDetails] = useState(false);
  const days0 = runway.days[0]?.date;
  const outgoingMinor = hasAccounts
    ? runway.days.reduce((total, day) => total + day.outMinor, 0)
    : dueSoon.totalMinor;
  const none = outgoingMinor === 0;
  const payments = `${dueSoon.count} payment${dueSoon.count === 1 ? '' : 's'}`;
  const comingIn = runway.inMinor > 0 ? ` · +${formatMoney(runway.inMinor)} coming in` : '';
  let note: string;
  if (!hasAccounts) {
    note = none
      ? 'Add a bank, cash or wallet account to see your balance.'
      : `going out · ${payments}. Add a bank, cash or wallet account to see your balance.`;
  } else if (runway.short) {
    note = `${formatMoney(outgoingMinor)} going out · short ${formatMoney(runway.short.minor)} on ${weekdayDayMonth(runway.short.date)}${comingIn}`;
  } else if (none) {
    note = `No payments in the next ${days} days${comingIn}`;
  } else {
    note = `${formatMoney(outgoingMinor)} going out. Ends at ${formatMoney(runway.endMinor)}, lowest ${formatMoney(runway.lowMinor)} on ${dayMonth(runway.lowDate)}${comingIn}`;
  }

  const short = runway.short;
  const repeatsShortfall = short != null && short.date === days0 && runway.startMinor === -short.minor;
  const recovery = repeatsShortfall ? runway.days.find((day) => day.afterMinor >= 0) : undefined;
  const verdict = runway.short
    ? `${formatMoney(runway.short.minor)} more needed`
    : none
      ? 'Nothing due'
      : 'Covered';
  const lowestIsCurrent = runway.lowDate === days0 && runway.lowMinor === runway.startMinor;
  const verdictSub = runway.short
    ? `First shortfall ${noBreak(runway.short.date === days0 ? 'today' : `on ${weekdayDayMonth(runway.short.date)}`)}`
    : none
      ? `No payments in the next ${days} days`
      : lowestIsCurrent
        ? null
        : `Lowest ${formatMoney(runway.lowMinor)} ${noBreak(runway.lowDate === days0 ? 'today' : `on ${weekdayDayMonth(runway.lowDate)}`)}`;
  return (
    <>
      <View style={local.card}>
        {hasAccounts ? (
          <>
            <View style={local.summary}>
              <View style={local.head}>
                <Feather
                  name={runway.short ? 'alert-circle' : 'check'}
                  size={16}
                  color={runway.short ? theme.colors.expenseText : theme.colors.incomeText}
                />
                <Text style={[local.statusText, runway.short && { color: theme.colors.expenseText }]}>
                  {verdict}
                </Text>
                <Text style={[local.summaryFact, local.headCopy]} numberOfLines={1}>
                  {`· next ${days} days`}
                </Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Forecast details. ${note}`}
                  onPress={() => setDetails(true)}
                  style={withPressed(local.info)}
                >
                  <Text style={local.summaryLink}>Details</Text>
                  <Feather name="chevron-right" size={13} color={theme.colors.link} />
                </Pressable>
              </View>
              {verdictSub && <Text style={local.summaryFact}>{verdictSub}</Text>}
              <View style={local.stats}>
                <View style={local.balanceColumn}>
                  <Text style={local.statLabel}>
                    {recovery
                      ? 'Projected recovery'
                      : repeatsShortfall
                        ? 'Lowest projected balance'
                        : 'Current balance'}
                  </Text>
                  <Text style={local.statValue}>
                    {recovery
                      ? dayMonth(recovery.date)
                      : formatMoney(repeatsShortfall ? runway.lowMinor : runway.startMinor)}
                  </Text>
                </View>
                <View style={[local.balanceColumn, local.projectedBalance]}>
                  <Text style={local.statLabel}>
                    Projected {dayMonth(runway.days.at(-1)?.date ?? runway.lowDate)}
                  </Text>
                  <Text style={[local.statValue, runway.endMinor < 0 && local.statNegative]}>
                    {formatMoney(runway.endMinor)}
                  </Text>
                </View>
              </View>
            </View>
            <RunwayRibbon runway={runway} onViewDay={onViewDay} />
          </>
        ) : (
          <>
            <View style={[local.summary, local.setupSummary]}>
              <Text style={local.summaryFact}>{`Scheduled outgoing · next ${days} days`}</Text>
              <Text style={local.verdict}>{formatMoney(outgoingMinor)}</Text>
            </View>
            <Text style={local.bigNote}>{note}</Text>
            <PrimaryButton title="Add account" variant="secondary" compact onPress={onAddAccount} />
          </>
        )}
        {onViewPayments && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="View payments"
            onPress={onViewPayments}
            style={withPressed(local.link)}
          >
            <Text style={local.linkText}>{dueSoon.count > 0 ? `View ${payments}` : 'View payments'}</Text>
            <Feather name="arrow-right" size={15} color={theme.colors.link} />
          </Pressable>
        )}
      </View>
      {details && hasAccounts && <ForecastDetails runway={runway} onClose={() => setDetails(false)} />}
    </>
  );
}

const local = themedStyles(() =>
  StyleSheet.create({
    card: {
      // No box around the sky card: the ribbon and the two balances sit on the page itself.
      marginHorizontal: 16,
      gap: 4,
    },
    summary: { paddingBottom: 6 },
    summaryFact: { fontFamily: theme.font.body, fontSize: 12, color: theme.colors.home.secondaryText },
    summaryLink: { fontFamily: theme.font.bodyMedium, fontSize: 13, color: theme.colors.link },
    setupSummary: { paddingTop: 12, gap: 4 },
    head: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    headCopy: { flex: 1, minWidth: 0 },
    status: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 7,
      paddingBottom: 2,
    },
    statusText: { fontFamily: theme.font.bodyBold, fontSize: 20, color: theme.colors.incomeText },
    verdict: {
      fontFamily: theme.font.bodyBold,
      fontSize: 20,
      lineHeight: 25,
      color: theme.colors.textPrimary,
      fontVariant: ['tabular-nums'],
    },
    info: {
      minWidth: 44,
      minHeight: 44,
      paddingHorizontal: 4,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 3,
    },
    stats: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 6 },
    balanceColumn: { flexGrow: 1, flexBasis: 110, minWidth: 0, gap: 2 },
    projectedBalance: { alignItems: 'flex-end' },
    statLabel: { fontFamily: theme.font.body, fontSize: 12, color: theme.colors.home.secondaryText },
    statValue: {
      fontFamily: theme.font.bodyBold,
      fontSize: 15,
      lineHeight: 20,
      color: theme.colors.textPrimary,
      fontVariant: ['tabular-nums'],
    },
    statNegative: { color: theme.colors.expenseText },
    bigNote: { fontFamily: theme.font.bodyMedium, fontSize: 13, color: theme.colors.textMuted },
    link: {
      minHeight: 36,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    linkText: { fontFamily: theme.font.bodyMedium, fontSize: 13, color: theme.colors.link },
  })
);
