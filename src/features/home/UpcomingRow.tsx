import { View, Text, Pressable, StyleSheet } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { theme } from '@/constants/theme';
import { formatMoney } from '@/lib/money';
import { SoftCard } from './SoftCard';

/**
 * The next EMI that's coming due — a single tappable row under "Upcoming"
 * that jumps to the Loans tab.
 */
export function UpcomingRow({
  counterparty,
  dueLabel,
  amountMinor,
  onPress,
}: {
  counterparty: string;
  dueLabel: string;
  amountMinor: number;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${counterparty} EMI, due ${dueLabel}`}
      style={styles.wrap}
    >
      <SoftCard backgroundColor={theme.colors.goldTint} padding={13} style={styles.card}>
        <View style={[styles.iconWrap, { backgroundColor: theme.colors.idGoldDeep }]}>
          <Feather name="calendar" size={14} color={theme.colors.white} />
        </View>
        <View style={styles.mid}>
          <Text style={styles.title} numberOfLines={1}>
            {counterparty} EMI
          </Text>
          <Text style={styles.sub} numberOfLines={1}>
            Due {dueLabel}
          </Text>
        </View>
        <Text style={styles.amount}>{formatMoney(amountMinor)}</Text>
        <Feather name="chevron-right" size={16} color={theme.colors.textMuted} />
      </SoftCard>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { marginHorizontal: 20 },
  card: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  iconWrap: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  mid: { flex: 1, minWidth: 0 },
  title: { fontFamily: theme.font.bodyBold, fontSize: 13.5, color: theme.colors.textPrimary },
  sub: { fontFamily: theme.font.body, fontSize: 11.5, color: theme.colors.textMuted, marginTop: 1 },
  amount: { fontFamily: theme.font.monoBold, fontSize: 13, color: theme.colors.textPrimary },
});
