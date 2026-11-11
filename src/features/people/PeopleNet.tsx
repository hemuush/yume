import { StyleSheet } from 'react-native';
import { Text } from '@/components/Text';
import {
  SummaryCard,
  SummaryFacts,
  SummarySide,
  SummarySplit,
  SummaryTop,
  summaryFigure,
} from '@/components/SummaryCard';
import { theme } from '@/constants/theme';
import { formatMoney } from '@/lib/money';

/**
 * Friends & Family's first card: the net of what you're owed against what you owe, then a bar split between
 * the two sides with each total and how many people are on it.
 */
export function PeopleNet({
  netMinor,
  owedToYouMinor,
  youOweMinor,
  owedCount,
  oweCount,
}: {
  netMinor: number;
  owedToYouMinor: number;
  youOweMinor: number;
  owedCount: number;
  oweCount: number;
}) {
  const color =
    netMinor > 0
      ? theme.colors.incomeText
      : netMinor < 0
        ? theme.colors.expenseText
        : theme.colors.textPrimary;
  const people = owedCount + oweCount;
  return (
    <SummaryCard style={styles.card}>
      <SummaryTop
        label={netMinor > 0 ? 'Net, in your favour' : netMinor < 0 ? 'Net, against you' : 'Net, even'}
        figure={
          <Text style={[summaryFigure, { color }]} numberOfLines={1} adjustsFontSizeToFit>
            {netMinor > 0 ? '+' : netMinor < 0 ? '−' : ''}
            {formatMoney(Math.abs(netMinor))}
          </Text>
        }
        side={
          <SummarySide
            main={`${people} ${people === 1 ? 'person' : 'people'}`}
            note={`${owedCount} owe you · you owe ${oweCount}`}
          />
        }
      />
      <SummarySplit
        parts={[
          { key: 'owed', weight: owedToYouMinor, color: theme.colors.slice.saved },
          { key: 'owe', weight: youOweMinor, color: theme.colors.slice.spent },
        ]}
      />
      <SummaryFacts
        facts={[
          { label: 'Owed to you', value: `+${formatMoney(owedToYouMinor)}`, tone: 'good' },
          { label: 'You owe', value: formatMoney(youOweMinor), tone: 'bad' },
        ]}
      />
    </SummaryCard>
  );
}

// The screen's content already clears the header with the usual gap, so the card adds none of its own.
const styles = StyleSheet.create({
  card: { marginTop: 0, marginBottom: 6 },
});
