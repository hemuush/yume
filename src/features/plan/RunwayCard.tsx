import { useState } from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { ForecastDetails } from './ForecastDetails';
import { withPressed } from '@/lib/pressed';
import { PrimaryButton } from '@/components/PrimaryButton';
import { Text } from '@/components/Text';
import { Glass } from '@/components/Glass';
import { screenStyles } from '@/components/screenStyles';
import { RunwayChart } from './RunwayChart';
import { cardSurface } from '@/components/CardSurface';
import { theme } from '@/constants/theme';
import { formatMoney } from '@/lib/money';
import { dayMonth, weekdayDayMonth } from '@/lib/dateLabels';
import { DueSoon } from './planOverview';
import { Runway } from './runway';
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

  if (compact)
    return (
      <>
        <View style={[screenStyles.card, local.card]}>
          <View style={styles.forecastHeading}>
            <View style={styles.forecastFigure}>
              <Text style={styles.forecastFact}>
                {hasAccounts ? `Runway · next ${days} days` : `Scheduled outgoing · next ${days} days`}
              </Text>
              <Text style={styles.forecastValue}>{hasAccounts ? figure : formatMoney(outgoingMinor)}</Text>
            </View>
            {hasAccounts && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Forecast details. ${note}`}
                onPress={() => setDetails(true)}
                style={withPressed({
                  width: 44,
                  minHeight: 44,
                  alignItems: 'center',
                  justifyContent: 'center',
                })}
              >
                <Feather name="info" size={18} color={theme.colors.link} />
              </Pressable>
            )}
          </View>
          {hasAccounts ? (
            <>
              <View style={local.verdictRow}>
                <View style={[local.chip, runway.short ? local.chipBad : local.chipOk]}>
                  <Feather
                    name={runway.short ? 'alert-circle' : 'check-circle'}
                    size={14}
                    color={runway.short ? theme.colors.expenseText : theme.colors.incomeText}
                  />
                  <Text
                    style={[
                      local.chipText,
                      { color: runway.short ? theme.colors.expenseText : theme.colors.incomeText },
                    ]}
                  >
                    {none
                      ? 'Nothing due'
                      : runway.short
                        ? `${formatMoney(runway.short.minor)} more needed`
                        : 'Covered'}
                  </Text>
                </View>
              </View>
              {none ? (
                <Text style={styles.forecastFact}>{note}</Text>
              ) : (
                <View style={styles.forecastFacts}>
                  <Fact label="Going out" value={formatMoney(outgoingMinor)} />
                  <Fact label="Coming in" value={`+${formatMoney(runway.inMinor)}`} />
                  <Fact
                    label="Lowest"
                    value={formatMoney(runway.lowMinor)}
                    sub={runway.lowDate === days0 ? 'today' : dayMonth(runway.lowDate)}
                    bad={runway.lowMinor < 0}
                  />
                </View>
              )}
              {!none && runway.days.length > 1 && <RunwayChart runway={runway} />}
            </>
          ) : (
            <>
              <Text style={styles.bigNote}>{note}</Text>
              <PrimaryButton title="Add account" variant="secondary" compact onPress={onAddAccount} />
            </>
          )}
          {onViewPayments && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="View payments"
              onPress={onViewPayments}
              style={withPressed({
                minHeight: 44,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
              })}
            >
              <Text style={{ fontFamily: theme.font.bodyMedium, fontSize: 13, color: theme.colors.link }}>
                View payments
              </Text>
              <Feather name="arrow-right" size={16} color={theme.colors.link} />
            </Pressable>
          )}
        </View>
        {details && hasAccounts && <ForecastDetails runway={runway} onClose={() => setDetails(false)} />}
      </>
    );

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

function Fact({ label, value, sub, bad }: { label: string; value: string; sub?: string; bad?: boolean }) {
  return (
    <View style={styles.forecastMetric}>
      <Text style={styles.forecastFact}>{sub ? `${label} · ${sub}` : label}</Text>
      <Text
        style={[styles.forecastMetricValue, bad && { color: theme.colors.expenseText }]}
        numberOfLines={1}
        adjustsFontSizeToFit
      >
        {value}
      </Text>
    </View>
  );
}

const local = StyleSheet.create({
  card: { padding: 16, marginTop: 4, gap: 4 },
  verdictRow: { flexDirection: 'row', marginTop: 2, marginBottom: 4 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 28,
    paddingHorizontal: 10,
    borderRadius: 14,
  },
  chipOk: { backgroundColor: theme.colors.incomeTint },
  chipBad: { backgroundColor: theme.colors.expenseTint },
  chipText: { fontFamily: theme.font.bodyBold, fontSize: 12 },
});
