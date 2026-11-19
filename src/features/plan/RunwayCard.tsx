import { useState } from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Feather from '@expo/vector-icons/Feather';
import { RunwayRibbon } from './RunwayRibbon';
import { ForecastDetails } from './ForecastDetails';
import { withPressed } from '@/lib/pressed';
import { PrimaryButton } from '@/components/PrimaryButton';
import { Text } from '@/components/Text';
import { Glass } from '@/components/Glass';
import { softTint } from '@/components/softTint';
import { cardSurface } from '@/components/CardSurface';
import { theme } from '@/constants/theme';
import { formatMoney } from '@/lib/money';
import { dayMonth, weekdayDayMonth } from '@/lib/dateLabels';
import { DueSoon } from './planOverview';
import { Runway } from './runway';
import { Kicker } from './PlanTiles';
import { styles } from './plan.styles';
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
  compact = false,
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
  compact?: boolean;
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
  let figure: string;
  let note: string;
  if (!hasAccounts) {
    figure = none ? 'Nothing due' : formatMoney(outgoingMinor);
    note = none
      ? 'Add a bank, cash or wallet account to see your balance.'
      : `going out · ${payments}. Add a bank, cash or wallet account to see your balance.`;
  } else if (runway.short) {
    figure = formatMoney(runway.startMinor);
    note = `${formatMoney(outgoingMinor)} going out · short ${formatMoney(runway.short.minor)} on ${weekdayDayMonth(runway.short.date)}${comingIn}`;
  } else if (none) {
    figure = formatMoney(runway.startMinor);
    note = `No payments in the next ${days} days${comingIn}`;
  } else {
    figure = formatMoney(runway.startMinor);
    note = `${formatMoney(outgoingMinor)} going out. Ends at ${formatMoney(runway.endMinor)}, lowest ${formatMoney(runway.lowMinor)} on ${dayMonth(runway.lowDate)}${comingIn}`;
  }

  if (compact) {
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
          <LinearGradient
            pointerEvents="none"
            style={StyleSheet.absoluteFill}
            colors={[softTint(theme.colors.primary, 0.12), softTint(theme.colors.primary, 0)]}
            start={{ x: 1, y: 0 }}
            end={{ x: 0.25, y: 0.8 }}
          />
          {hasAccounts ? (
            <>
              <View style={local.head}>
                <Text style={[styles.forecastFact, local.headCopy]}>{`Runway · next ${days} days`}</Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Forecast details. ${note}`}
                  onPress={() => setDetails(true)}
                  style={withPressed(local.info)}
                >
                  <Text style={local.linkText}>Details</Text>
                  <Feather name="chevron-right" size={13} color={theme.colors.link} />
                </Pressable>
              </View>
              <View style={local.status}>
                <Feather
                  name={runway.short ? 'alert-circle' : 'check'}
                  size={15}
                  color={runway.short ? theme.colors.expenseText : theme.colors.incomeText}
                />
                <View style={local.headCopy}>
                  <Text style={[local.statusText, runway.short && { color: theme.colors.expenseText }]}>
                    {verdict}
                  </Text>
                  {verdictSub && <Text style={styles.forecastFact}>{verdictSub}</Text>}
                </View>
              </View>
              <RunwayRibbon runway={runway} onViewDay={onViewDay} />
              <View style={local.balanceColumns}>
                <View style={local.balanceColumn}>
                  <Text style={styles.forecastFact}>
                    {recovery
                      ? 'Projected recovery'
                      : repeatsShortfall
                        ? 'Lowest projected balance'
                        : 'Current balance'}
                  </Text>
                  <Text style={local.factValue}>
                    {recovery
                      ? dayMonth(recovery.date)
                      : formatMoney(repeatsShortfall ? runway.lowMinor : runway.startMinor)}
                  </Text>
                </View>
                <View style={[local.balanceColumn, local.projectedBalance]}>
                  <Text style={styles.forecastFact}>
                    Projected {dayMonth(runway.days.at(-1)?.date ?? runway.lowDate)}
                  </Text>
                  <Text style={[local.factValue, runway.endMinor < 0 && local.negative]}>
                    {formatMoney(runway.endMinor)}
                  </Text>
                </View>
              </View>
            </>
          ) : (
            <>
              <View style={styles.forecastFigure}>
                <Text style={styles.forecastFact}>{`Scheduled outgoing · next ${days} days`}</Text>
                <Text style={local.verdict}>{formatMoney(outgoingMinor)}</Text>
              </View>
              <Text style={styles.bigNote}>{note}</Text>
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

  return (
    <>
      <Glass radius={24} tone="strong" style={[styles.card, styles.cardFirst, cardSurface.summary]}>
        <View style={styles.forecastHeading}>
          <View style={styles.forecastFigure}>
            <Text style={styles.forecastFact}>
              {hasAccounts ? 'Spending accounts' : 'Scheduled outgoing'}
            </Text>
            <Text style={styles.forecastValue}>{figure}</Text>
          </View>
          <Kicker icon="calendar">Next {days} days</Kicker>
        </View>
        <View style={styles.forecastFacts}>
          <View style={styles.forecastMetric}>
            <Text style={styles.forecastFact}>Going out</Text>
            <Text style={styles.forecastMetricValue}>{formatMoney(outgoingMinor)}</Text>
          </View>
          <View style={styles.forecastMetric}>
            <Text style={styles.forecastFact}>Coming in</Text>
            <Text style={styles.forecastMetricValue}>{formatMoney(runway.inMinor)}</Text>
          </View>
        </View>
        {hasAccounts ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Forecast details. ${note}`}
            onPress={() => setDetails(true)}
            style={withPressed([styles.forecastAttention, runway.short && styles.forecastWarning])}
          >
            <View style={[styles.forecastStatusIcon, runway.short && styles.forecastStatusWarning]}>
              <Feather
                name={runway.short ? 'alert-circle' : 'check-circle'}
                size={19}
                color={runway.short ? theme.colors.expenseText : theme.colors.incomeText}
              />
            </View>
            <View style={styles.forecastAttentionCopy}>
              <Text style={[styles.forecastStatusTitle, runway.short && { color: theme.colors.expenseText }]}>
                {none
                  ? 'Nothing due'
                  : runway.short
                    ? `${formatMoney(runway.short.minor)} more needed`
                    : 'Covered'}
              </Text>
              <Text style={styles.forecastFact}>
                {none
                  ? note
                  : runway.short
                    ? `First shortfall · ${dayMonth(runway.short.date)}`
                    : `Lowest ${formatMoney(runway.lowMinor)} on ${dayMonth(runway.lowDate)}`}
              </Text>
            </View>
            <Feather name="chevron-right" size={16} color={theme.colors.textSecondary} />
          </Pressable>
        ) : (
          <View style={{ gap: 8 }}>
            <Text style={styles.bigNote}>{note}</Text>
            {onAddAccount && (
              <PrimaryButton title="Add account" variant="secondary" compact onPress={onAddAccount} />
            )}
          </View>
        )}
      </Glass>
      {details && hasAccounts && <ForecastDetails runway={runway} onClose={() => setDetails(false)} />}
    </>
  );
}

const local = themedStyles(() =>
  StyleSheet.create({
    card: {
      marginHorizontal: 16,
      paddingHorizontal: 14,
      paddingTop: 4,
      paddingBottom: 2,
      gap: 4,
      borderRadius: 20,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.colors.home.edge,
      backgroundColor: theme.colors.home.surface,
      overflow: 'hidden',
    },
    head: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    headCopy: { flex: 1, minWidth: 0 },
    status: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 7,
      paddingBottom: 2,
    },
    statusText: { fontFamily: theme.font.bodyBold, fontSize: 24, color: theme.colors.incomeText },
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
    balanceColumns: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
      paddingVertical: 7,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.colors.home.edge,
    },
    balanceColumn: { flexGrow: 1, flexBasis: 110, minWidth: 0, gap: 2 },
    projectedBalance: { alignItems: 'flex-end' },
    negative: { color: theme.colors.expenseText },
    factValue: {
      fontFamily: theme.font.bodyMedium,
      fontSize: 15,
      lineHeight: 20,
      color: theme.colors.textPrimary,
      fontVariant: ['tabular-nums'],
    },
    link: {
      minHeight: 44,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    linkText: { fontFamily: theme.font.bodyMedium, fontSize: 13, color: theme.colors.link },
  })
);
