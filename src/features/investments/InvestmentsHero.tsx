import { StyleSheet } from 'react-native';
import { Text } from '@/components/Text';
import { CountUpAmount } from '@/components/CountUpAmount';
import { PrimaryButton } from '@/components/PrimaryButton';
import {
  SummaryCard,
  SummaryFacts,
  SummarySide,
  SummaryTop,
  summaryFigure,
  summaryNote,
  type FactTone,
  type SummaryFact,
} from '@/components/SummaryCard';
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
  const returnTone = hideAmounts || gain == null || gain === 0 ? undefined : gain > 0 ? 'good' : 'bad';
  const facts: SummaryFact[] = [
    { label: 'Put in', value: money(portfolio.investedMinor) },
    ...(portfolio.takenOutMinor > 0 ? [{ label: 'Taken out', value: money(portfolio.takenOutMinor) }] : []),
    ...(gain != null
      ? [
          {
            label: 'Gain',
            value: hideAmounts ? '••••' : `${gain < 0 ? '−' : gain > 0 ? '+' : ''}${money(Math.abs(gain))}`,
            tone: returnTone as FactTone | undefined,
          },
        ]
      : []),
    ...(sipMonthly > 0 ? [{ label: 'SIPs', value: `${money(sipMonthly)} a month` }] : []),
  ];
  return (
    <SummaryCard>
      <SummaryTop
        label="Worth now"
        figure={
          hideAmounts ? (
            <Text style={summaryFigure}>
              {formatMaskableMoney(portfolio.valueMinor, { currency, masked: true })}
            </Text>
          ) : (
            <CountUpAmount
              minor={portfolio.valueMinor}
              currency={currency}
              countFromZero={false}
              style={summaryFigure}
              numberOfLines={1}
              adjustsFontSizeToFit
            />
          )
        }
        side={
          portfolio.returnPct != null ? (
            <SummarySide
              main={hideAmounts ? '••% return' : `${formatReturnPct(portfolio.returnPct)} return`}
              tone={returnTone}
            />
          ) : undefined
        }
      />
      <SummaryFacts facts={facts} />
      {rate && (
        <Text style={styles.hint}>
          {hideAmounts
            ? '••% a year'
            : `${formatReturnPct(rate.rate * 100).replace('+', '')} a year over ${years(rate.days)}`}
        </Text>
      )}
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
    </SummaryCard>
  );
}

/** What a first-time visitor sees: three steps and one button. */
export function StartTracking({ onAdd }: { onAdd: () => void }) {
  return (
    <SummaryCard>
      <Text style={styles.title}>Start tracking in 3 steps</Text>
      {[
        'Add an investment: a fund, stocks, gold or a deposit.',
        'Invest money into it from a bank account.',
        'Update its value now and then to see the gain.',
      ].map((line, i) => (
        <Text key={line} style={styles.hint}>
          <Text style={styles.stepNo}>{i + 1}. </Text>
          {line}
        </Text>
      ))}
      <PrimaryButton title="Add your first investment" onPress={onAdd} />
    </SummaryCard>
  );
}

const styles = StyleSheet.create({
  title: { fontFamily: theme.font.roundedBold, fontSize: 15, color: theme.colors.textPrimary },
  hint: { ...summaryNote, paddingHorizontal: 2 },
  stepNo: { fontFamily: theme.font.bodyBold, color: theme.colors.textPrimary },
});
