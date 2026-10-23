import { View, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Text } from '@/components/Text';
import type { McIconName } from '@/components/iconName';
import { theme } from '@/constants/theme';
import { shade } from '@/lib/color';

/**
 * The top card of a loan's details: its name and rate on the first line with the outstanding amount beside it,
 * the repayment bar inside the card, and one line under it for how many EMIs are paid and when it ends.
 */
export function LoanHero({
  hue,
  icon,
  title,
  kicker,
  outstanding,
  fraction,
  paid,
  ends,
}: {
  hue: string;
  icon: string;
  title: string;
  kicker: string;
  /** The amount still owed (or still to come), already formatted. */
  outstanding: string;
  /** 0–1, how much of the schedule is paid. */
  fraction: number;
  /** Leads the line under the bar: "0 of 48" (then "EMIs paid"), or a plain message such as "Loading…". */
  paid: { figure: string } | { message: string };
  /** "Debt-free October 2030" on the right of that line. */
  ends?: string;
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
        <Text style={styles.amount}>{outstanding}</Text>
      </View>
      <View style={styles.track}>
        <View
          style={[
            styles.fill,
            { backgroundColor: shade(hue, 46), width: `${Math.min(100, Math.max(0, fraction * 100))}%` },
          ]}
        />
      </View>
      <View style={styles.line}>
        <Text style={styles.caption}>
          {'figure' in paid ? (
            <>
              <Text style={styles.figure}>{paid.figure}</Text> EMIs paid
            </>
          ) : (
            paid.message
          )}
        </Text>
        {!!ends && <Text style={[styles.caption, styles.ends]}>{ends}</Text>}
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
  amount: {
    fontFamily: theme.font.body,
    fontSize: 22,
    lineHeight: 28,
    fontVariant: ['tabular-nums'],
    color: theme.colors.textPrimary,
  },
  track: {
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.colors.glass,
    marginTop: 12,
    overflow: 'hidden',
  },
  fill: { height: '100%', borderRadius: 4 },
  line: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 4, marginTop: 8 },
  caption: { fontFamily: theme.font.body, fontSize: 12.5, lineHeight: 18, color: theme.colors.textSecondary },
  figure: {
    fontFamily: theme.font.bodyMedium,
    color: theme.colors.textPrimary,
    fontVariant: ['tabular-nums'],
  },
  ends: { fontFamily: theme.font.bodyMedium, color: theme.colors.textPrimary },
});
