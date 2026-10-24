import { View, StyleSheet } from 'react-native';
import { Text } from '@/components/Text';
import { Glass } from '@/components/Glass';
import { CountUpAmount } from '@/components/CountUpAmount';
import { PrimaryButton } from '@/components/PrimaryButton';
import { cardSurface } from '@/components/CardSurface';
import { Kicker, FrostChip, frost } from '@/components/Frost';
import { theme } from '@/constants/theme';
import { formatMaskableMoney } from '@/lib/money';
import { formatReturnPct } from '@/lib/investment';
import { usePrivacy } from '@/theme/PrivacyContext';
import type { Portfolio } from '@/lib/portfolio';

const years = (days: number) => {
  const y = days / 365;
  return y >= 2 ? `${Math.round(y * 10) / 10} years` : `${Math.max(1, Math.round(days / 30.44))} months`;
};

/**
 * The first card of the Investments page: what the holdings are worth, the return, the gain and the yearly
 * rate as chips, and what went in. With amounts hidden the figures are masked and the colours neutral.
 */
export function InvestmentsHero({
  portfolio,
  rate,
  currency,
  sipMonthly,
}: {
  portfolio: Portfolio;
  /** The yearly rate and the days of history it comes from; null until there is enough history. */
  rate: { rate: number; days: number } | null;
  currency: string;
  sipMonthly: number;
}) {
  const { hideAmounts } = usePrivacy();
  const money = (minor: number) => formatMaskableMoney(minor, { currency, masked: hideAmounts });
  const gain = portfolio.gainMinor;
  const gainColor =
    gain == null || gain === 0
      ? theme.colors.textPrimary
      : gain > 0
        ? theme.colors.incomeText
        : theme.colors.expenseText;
  return (
    <Glass radius={22} tone="strong" style={[frost.hero, cardSurface.summary, styles.block]}>
      <View style={frost.heroRow}>
        <View style={[frost.heroMain, { gap: 2 }]}>
          <Kicker icon="trending-up">Worth now</Kicker>
          {hideAmounts ? (
            <Text style={[frost.bigValue, styles.bigFigure]}>
              {formatMaskableMoney(portfolio.valueMinor, { currency, masked: true })}
            </Text>
          ) : (
            <CountUpAmount
              minor={portfolio.valueMinor}
              currency={currency}
              countFromZero={false}
              symbolStyle={frost.bigSymbol}
              style={[frost.bigValue, styles.bigFigure]}
              numberOfLines={1}
              adjustsFontSizeToFit
            />
          )}
        </View>
        {portfolio.returnPct != null && (
          <View style={frost.side}>
            <Text style={frost.sideLabel}>Return</Text>
            <Text style={[frost.sideValue, !hideAmounts && { color: gainColor }]}>
              {hideAmounts ? '••%' : formatReturnPct(portfolio.returnPct)}
            </Text>
          </View>
        )}
      </View>
      <View style={frost.chips}>
        {gain != null && (
          <FrostChip
            icon={gain < 0 ? 'trending-down' : 'trending-up'}
            tone={hideAmounts || gain === 0 ? undefined : gain > 0 ? 'ok' : 'bad'}
          >
            {hideAmounts ? '••••' : `${gain < 0 ? '−' : gain > 0 ? '+' : ''}${money(Math.abs(gain))}`}
          </FrostChip>
        )}
        {rate && (
          <FrostChip icon="calendar">
            {hideAmounts
              ? '••% a year'
              : `${formatReturnPct(rate.rate * 100).replace('+', '')} a year over ${years(rate.days)}`}
          </FrostChip>
        )}
      </View>
      <Text style={frost.sub}>
        Put in <Text style={frost.subBold}>{money(portfolio.investedMinor)}</Text>
        {portfolio.takenOutMinor > 0 && (
          <>
            {' · taken out '}
            <Text style={frost.subBold}>{money(portfolio.takenOutMinor)}</Text>
          </>
        )}
        {sipMonthly > 0 && (
          <>
            {' · SIPs '}
            <Text style={frost.subBold}>{money(sipMonthly)}</Text> a month
          </>
        )}
      </Text>
      {(gain == null || (!rate && !hideAmounts) || portfolio.unvaluedCount > 0) && (
        <Text style={styles.hint}>
          {gain == null
            ? 'Update a value to see the gain.'
            : !rate
              ? 'A yearly rate needs three months of history.'
              : ''}
          {portfolio.unvaluedCount > 0 && gain != null
            ? ` ${portfolio.unvaluedCount} ${portfolio.unvaluedCount === 1 ? 'holding has' : 'holdings have'} no value yet.`
            : ''}
        </Text>
      )}
    </Glass>
  );
}

/** What a first-time visitor sees: three steps and one button. */
export function StartTracking({ onAdd }: { onAdd: () => void }) {
  return (
    <Glass radius={22} tone="strong" style={[frost.hero, cardSurface.summary, styles.block]}>
      <Kicker icon="trending-up">Start tracking in 3 steps</Kicker>
      {[
        'Add an investment: a fund, stocks, gold or a deposit.',
        'Invest money into it from a bank account.',
        'Update its value now and then to see the gain.',
      ].map((line, i) => (
        <Text key={line} style={frost.sub}>
          <Text style={frost.subBold}>{i + 1}. </Text>
          {line}
        </Text>
      ))}
      <PrimaryButton title="Add your first investment" onPress={onAdd} />
    </Glass>
  );
}

const styles = StyleSheet.create({
  // Cards sit on the screen gutter like every other screen's; the sections below bring their own.
  block: { marginTop: 0, marginBottom: 12 },
  bigFigure: { fontFamily: theme.font.bodyLight, fontSize: 30, lineHeight: 36 },
  hint: { fontFamily: theme.font.body, fontSize: 12, lineHeight: 17, color: theme.colors.textMuted },
});
