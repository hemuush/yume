import { useState } from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { ForecastDetails } from './ForecastDetails';
import { withPressed } from '@/lib/pressed';
import { PrimaryButton } from '@/components/PrimaryButton';
import { Text } from '@/components/Text';
import { Glass } from '@/components/Glass';
import { screenStyles } from '@/components/screenStyles';
import { RunwayRibbon } from './RunwayRibbon';
import { cardSurface } from '@/components/CardSurface';
import { theme } from '@/constants/theme';
import { formatMoney } from '@/lib/money';
import { dayMonth, weekdayDayMonth } from '@/lib/dateLabels';
import { DueSoon } from './planOverview';
import { Runway } from './runway';
import { useStacked } from '@/lib/useStacked';
import { Kicker } from './PlanTiles';
import { styles } from './plan.styles';

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
  } else if (none) {
    figure = formatMoney(runway.startMinor);
    note = `No payments in the next ${days} days${comingIn}`;
  } else if (runway.short) {
    figure = formatMoney(runway.startMinor);
    note = `${formatMoney(outgoingMinor)} going out · short ${formatMoney(runway.short.minor)} on ${weekdayDayMonth(runway.short.date)}${comingIn}`;
  } else {
    figure = formatMoney(runway.startMinor);
    note = `${formatMoney(outgoingMinor)} going out · ${payments}. Ends at ${formatMoney(runway.endMinor)}, lowest ${formatMoney(runway.lowMinor)} on ${dayMonth(runway.lowDate)}${comingIn}`;
  }

  if (compact) {
    const endDate = runway.days.at(-1)?.date;
    const verdict = none
      ? 'Nothing due'
      : runway.short
        ? `${formatMoney(runway.short.minor)} more needed`
        : 'Covered';
    // One line under the verdict: when it bites, or how low it gets.
    const verdictSub = none
      ? `No payments in the next ${days} days`
      : `Lowest ${formatMoney(runway.lowMinor)} on ${runway.lowDate === days0 ? 'today' : weekdayDayMonth(runway.lowDate)}`;
    return (
      <>
        <View style={[screenStyles.card, local.card]}>
          {hasAccounts ? (
            <>
              <View style={local.head}>
                <View style={[local.mark, runway.short ? local.chipBad : local.chipOk]}>
                  <Feather
                    name={runway.short ? 'alert-circle' : 'check'}
                    size={15}
                    color={runway.short ? theme.colors.expenseText : theme.colors.incomeText}
                  />
                </View>
                <View style={local.headCopy}>
                  <Text style={styles.forecastFact}>{`Runway · next ${days} days`}</Text>
                  <Text style={[local.verdict, runway.short && { color: theme.colors.expenseText }]}>
                    {verdict}
                  </Text>
                  <Text style={styles.forecastFact}>{verdictSub}</Text>
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Forecast details. ${note}`}
                  onPress={() => setDetails(true)}
                  hitSlop={6}
                  style={withPressed(local.info)}
                >
                  <Feather name="info" size={17} color={theme.colors.link} />
                </Pressable>
              </View>
              {!none && runway.days.length > 1 && <RunwayRibbon runway={runway} />}
              <View style={local.sum}>
                <Fact label="Now" value={formatMoney(runway.startMinor)} />
                <Fact label="Going out" value={`${none ? '' : '−'}${formatMoney(outgoingMinor)}`} />
                <Fact label="Coming in" value={`+${formatMoney(runway.inMinor)}`} good={runway.inMinor > 0} />
                <Fact
                  label={endDate ? `On ${dayMonth(endDate)}` : 'Ends at'}
                  value={formatMoney(runway.endMinor)}
                  bad={runway.endMinor < 0}
                />
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

function Fact({ label, value, bad, good }: { label: string; value: string; bad?: boolean; good?: boolean }) {
  // Four across leave a label such as "Coming in" a quarter of the row; on a narrow phone or at large text the
  // four go two to a row instead of breaking inside a word.
  const stacked = useStacked();
  return (
    <View style={[local.fact, stacked && local.factHalf]}>
      <Text style={styles.forecastFact}>{label}</Text>
      <Text
        style={[
          local.factValue,
          good && { color: theme.colors.incomeText },
          bad && { color: theme.colors.expenseText },
        ]}
        numberOfLines={1}
        adjustsFontSizeToFit
      >
        {value}
      </Text>
    </View>
  );
}

const local = StyleSheet.create({
  card: { paddingHorizontal: 14, paddingTop: 12, paddingBottom: 2, marginTop: 4, gap: 10 },
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  headCopy: { flex: 1, minWidth: 0 },
  mark: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  // The answer in words: Fredoka at section-title size, never a hero figure.
  verdict: {
    fontFamily: theme.font.roundedBold,
    fontSize: theme.typeSize.section,
    lineHeight: 21,
    color: theme.colors.textPrimary,
    fontVariant: ['tabular-nums'],
  },
  info: { width: 32, minHeight: 32, alignItems: 'center', justifyContent: 'center' },
  // Now − out + in = the closing balance, read left to right.
  sum: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 4, rowGap: 6 },
  fact: { flexGrow: 1, flexBasis: 64, minWidth: 0 },
  factHalf: { flexBasis: '45%' },
  factValue: {
    fontFamily: theme.font.bodyMedium,
    fontSize: 14,
    lineHeight: 20,
    color: theme.colors.textPrimary,
    fontVariant: ['tabular-nums'],
  },
  link: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.divider,
  },
  linkText: { fontFamily: theme.font.bodyMedium, fontSize: 13, color: theme.colors.link },
  chipOk: { backgroundColor: theme.colors.incomeTint },
  chipBad: { backgroundColor: theme.colors.expenseTint },
});
