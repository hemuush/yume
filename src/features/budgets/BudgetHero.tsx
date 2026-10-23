import { View, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Text } from '@/components/Text';
import { LimitMeter, type LimitMeterTone } from '@/components/LimitMeter';
import type { McIconName } from '@/components/iconName';
import { theme } from '@/constants/theme';
import { shade } from '@/lib/color';

/**
 * The top card of a budget's overview: the category and what is left on the first line, the meter with its pace
 * marker inside the card, and one line under it saying what was spent of the limit and how the budget is doing.
 */
export function BudgetHero({
  hue,
  icon,
  title,
  kicker,
  remaining,
  over,
  pct,
  tone,
  marker,
  animKey,
  spent,
  limit,
  status,
}: {
  hue: string;
  icon: string;
  title: string;
  kicker: string;
  /** The amount left (or over), already formatted. */
  remaining: string;
  over: boolean;
  /** 0–100, how much of the limit is used. */
  pct: number;
  tone: LimitMeterTone;
  /** Where an even pace would be today, 0–100; none for a month that is over. */
  marker?: number;
  animKey: string;
  spent: string;
  limit: string;
  status: string;
}) {
  return (
    <View style={styles.card}>
      <LinearGradient
        pointerEvents="none"
        colors={[shade(hue, 89), shade(hue, 96)]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      {/* Wraps under the name when the amount is wide or the text is enlarged. */}
      <View style={styles.top}>
        <View style={styles.identity}>
          <View style={[styles.icon, { backgroundColor: theme.colors.glass }]}>
            <MaterialCommunityIcons name={icon as McIconName} size={19} color={shade(hue, 30, 10)} />
          </View>
          <View style={styles.names}>
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.kicker}>{kicker}</Text>
          </View>
        </View>
        <Text style={[styles.amount, over && styles.amountOver]}>{remaining}</Text>
      </View>
      <View style={styles.meter}>
        <LimitMeter
          pct={pct}
          tone={tone}
          marker={marker}
          animKey={animKey}
          trackColor={theme.colors.glass}
          height={8}
        />
      </View>
      <View style={styles.line}>
        <Text style={styles.spent}>
          <Text style={styles.spentFigure}>{spent}</Text> spent of {limit}
        </Text>
        <Text style={styles.status}>{status}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: theme.colors.glass,
    backgroundColor: theme.colors.surface,
    marginBottom: 10,
  },
  top: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  identity: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 150,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  icon: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  names: { flex: 1, minWidth: 0 },
  title: { fontFamily: theme.font.bodyMedium, fontSize: 15, color: theme.colors.textPrimary },
  kicker: { fontFamily: theme.font.body, fontSize: 12, lineHeight: 17, color: theme.colors.textSecondary },
  amount: { fontFamily: theme.font.body, fontSize: 22, lineHeight: 28, fontVariant: ['tabular-nums'] },
  amountOver: { color: theme.colors.expenseText },
  meter: { marginTop: 12 },
  line: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 4, marginTop: 8 },
  spent: { fontFamily: theme.font.body, fontSize: 12.5, lineHeight: 18, color: theme.colors.textSecondary },
  spentFigure: {
    fontFamily: theme.font.bodyMedium,
    color: theme.colors.textPrimary,
    fontVariant: ['tabular-nums'],
  },
  status: { fontFamily: theme.font.body, fontSize: 12.5, lineHeight: 18, color: theme.colors.textSecondary },
});
