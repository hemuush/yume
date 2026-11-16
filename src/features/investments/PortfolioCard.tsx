import { memo, useMemo, useState } from 'react';
import { StyleSheet } from 'react-native';
import { ListCard } from '@/components/SummaryCard';
import { SegmentedControl } from '@/components/SegmentedControl';
import { theme } from '@/constants/theme';
import { seriesSince, type SeriesPoint } from '@/lib/portfolio';
import { PortfolioChart } from './PortfolioChart';
import { themedStyles } from '@/theme/themedStyles';

type Range = '6m' | '1y' | 'all';
const RANGE_MONTHS: Record<Range, number | null> = { '6m': 6, '1y': 12, all: null };
const OPTIONS: { label: string; value: Range }[] = [
  { label: '6 months', value: '6m' },
  { label: '1 year', value: '1y' },
  { label: 'All', value: 'all' },
];

/**
 * The trend card: worth against money put in over the chosen stretch. Which stretch is chosen is this card's own state,
 * so switching it draws the card, not the whole page.
 */
export const PortfolioCard = memo(function PortfolioCard({
  series,
  today,
  currency,
  masked,
}: {
  series: SeriesPoint[];
  today: string;
  currency: string;
  masked: boolean;
}) {
  const [range, setRange] = useState<Range>('1y');
  const shown = useMemo(() => seriesSince(series, RANGE_MONTHS[range], today), [series, range, today]);
  if (shown.length < 2) return null;
  return (
    <ListCard style={styles.card}>
      <SegmentedControl options={OPTIONS} value={range} onChange={setRange} />
      <PortfolioChart points={shown} currency={currency} masked={masked} color={theme.colors.ink} />
    </ListCard>
  );
});

const styles = themedStyles(() =>
  StyleSheet.create({
    // Cards sit on the screen gutter like every other screen's.
    card: { padding: 14, gap: 10, marginTop: 12 },
  })
);
