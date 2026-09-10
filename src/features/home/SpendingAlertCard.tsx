import { View, Text, StyleSheet } from 'react-native';
import { theme } from '@/constants/theme';
import { formatPctChange } from '@/lib/format';
import { SuuIllustration } from '@/components/SuuIllustration';
import { SoftCard } from './SoftCard';

/**
 * Shown only when spending is up on the previous period — the softer stand-in
 * for the old "Suu says" warn card. A flag plus, where we have one, the
 * category that moved most, so it points somewhere.
 */
export function SpendingAlertCard({
  changePct,
  comparisonLabel,
  topCategoryName,
}: {
  changePct: number;
  comparisonLabel: string;
  topCategoryName?: string;
}) {
  return (
    <SoftCard backgroundColor={theme.colors.goldTint} padding={13} style={styles.card}>
      <View style={styles.icon}>
        <SuuIllustration size={26} pose="default" />
      </View>
      <Text style={styles.text}>
        <Text style={styles.bold}>Suu: </Text>
        spending&rsquo;s up {formatPctChange(changePct)} on {comparisonLabel}
        {topCategoryName ? ` — mostly ${topCategoryName}.` : '.'}
      </Text>
    </SoftCard>
  );
}

const styles = StyleSheet.create({
  card: { marginHorizontal: 20, marginTop: 12, flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  icon: {
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  text: {
    flex: 1,
    fontFamily: theme.font.body,
    fontSize: 12,
    lineHeight: 17,
    color: theme.colors.textPrimary,
  },
  bold: { fontFamily: theme.font.bodyBold },
});
