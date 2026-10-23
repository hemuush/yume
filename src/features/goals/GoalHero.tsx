import { View, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Text } from '@/components/Text';
import type { McIconName } from '@/components/iconName';
import { theme } from '@/constants/theme';
import { shade } from '@/lib/color';

/**
 * The top card of a goal's overview: the goal's name and what it is on the first line, the saved amount beside
 * it, the bar inside the card, and one line under it for what is left and by when, with the pace status on the
 * right and the monthly pace below. It replaces the tall card plus the separate Remaining block.
 */
export function GoalHero({
  hue,
  icon,
  name,
  kicker,
  saved,
  fraction,
  toGo,
  date,
  status,
  perMonth,
}: {
  hue: string;
  icon: string;
  name: string;
  kicker: string;
  /** The saved amount, already formatted (or masked). */
  saved: string;
  /** 0–1, how far the goal has got; 0 while amounts are hidden. */
  fraction: number;
  /** Leads the line under the bar: "₹9,500" (then "to go") or a plain "Target reached". Omitted while hidden. */
  toGo?: { figure: string } | { reached: true };
  /** The target date, already formatted. */
  date?: string;
  /** "Ahead", "Behind", "Past its date" … on the right of that line. */
  status?: string;
  /** "₹3,167 a month to stay on pace". */
  perMonth?: string;
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
            <Text style={styles.title}>{name}</Text>
            <Text style={styles.kicker}>{kicker}</Text>
          </View>
        </View>
        <Text style={styles.amount}>{saved}</Text>
      </View>
      <View style={styles.track}>
        <View
          style={[
            styles.fill,
            { backgroundColor: shade(hue, 46), width: `${Math.min(100, Math.max(0, fraction * 100))}%` },
          ]}
        />
      </View>
      {(toGo || date || status) && (
        <View style={styles.line}>
          <Text style={styles.caption}>
            {toGo &&
              ('figure' in toGo ? (
                <>
                  <Text style={styles.figure}>{toGo.figure}</Text> to go
                </>
              ) : (
                <Text style={styles.figure}>Target reached</Text>
              ))}
            {toGo && date ? ' · ' : ''}
            {date ? `by ${date}` : ''}
          </Text>
          {!!status && <Text style={[styles.caption, styles.status]}>{status}</Text>}
        </View>
      )}
      {!!perMonth && <Text style={styles.caption}>{perMonth}</Text>}
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
  status: { fontFamily: theme.font.bodyMedium, color: theme.colors.textPrimary },
});
