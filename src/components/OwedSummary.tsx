import { View, StyleSheet } from 'react-native';
import { Text } from '@/components/Text';
import { theme } from '@/constants/theme';
import { CountUpAmount } from './CountUpAmount';
import { Skeleton } from './Skeleton';
import { EYEBROW } from '@/constants/textStyles';

/**
 * The "You owe · Owed to you" pair at the top of Loans and Friends & Family.
 * Plain figures rather than coloured tiles: the colour lives on the number
 * (coral for money you owe, green for money owed to you).
 */
export function OwedSummary({
  youOweMinor,
  owedToYouMinor,
  loading,
}: {
  youOweMinor: number;
  owedToYouMinor: number;
  loading?: boolean;
}) {
  const stats = [
    { label: 'You owe', minor: youOweMinor, color: theme.colors.expenseText },
    { label: 'Owed to you', minor: owedToYouMinor, color: theme.colors.incomeText },
  ];
  return (
    <View style={styles.row}>
      {stats.map((s) => (
        <View key={s.label} style={styles.stat}>
          {loading ? (
            <>
              <Skeleton width={54} height={9} radius={4} />
              <Skeleton width={90} height={22} radius={5} style={styles.valueSkeleton} />
            </>
          ) : (
            <>
              <Text style={styles.label}>{s.label}</Text>
              <CountUpAmount
                minor={s.minor}
                style={[styles.value, { color: s.color }]}
                numberOfLines={1}
                adjustsFontSizeToFit
              />
            </>
          )}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  // The first block on Loans and Friends & Family, so it sits at the standard gap under the header.
  row: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 28,
    marginTop: theme.layout.screenTopGap,
    marginBottom: 18,
  },
  stat: { flex: 1, minWidth: 0 },
  label: EYEBROW,
  value: { fontFamily: theme.font.monoBold, fontSize: 22, marginTop: 4 },
  valueSkeleton: { marginTop: 6 },
});
