import { View, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Text } from '@/components/Text';
import { theme } from '@/constants/theme';
import { shade } from '@/lib/color';
import type { McIconName } from '@/components/iconName';

/**
 * Pastel identity summary matching the main screen cards. Compact form previews keep the identity
 * while read-only details retain their amount and context.
 */
export function SheetCard({
  hue,
  icon,
  kicker,
  amount,
  amountColor = theme.colors.textPrimary,
  title,
  meta,
  progress,
  style,
  compact = false,
}: {
  hue: string;
  icon: string;
  /** Secondary context under the title: "EXPENSE", "EVERY MONTH". */
  kicker?: string;
  /** The big figure — a string, or an <Amount> so hidden amounts stay hidden. None for a category. */
  amount?: React.ReactNode;
  amountColor?: string;
  title: string;
  meta?: string;
  /** 0–1: draws a bar under the meta line — how far a goal has got. */
  progress?: number;
  style?: StyleProp<ViewStyle>;
  compact?: boolean;
}) {
  return (
    <View style={[styles.card, compact && styles.compact, style]}>
      {!compact && (
        <LinearGradient
          pointerEvents="none"
          colors={[shade(hue, 89), shade(hue, 96)]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      )}
      <View style={styles.top}>
        <View style={[styles.icon, { backgroundColor: compact ? shade(hue, 92) : theme.colors.glass }]}>
          <MaterialCommunityIcons name={icon as McIconName} size={22} color={shade(hue, 30, 10)} />
        </View>
        <View style={styles.heading}>
          <Text style={styles.title}>{title}</Text>
          {kicker ? <Text style={styles.kicker}>{kicker}</Text> : null}
        </View>
      </View>
      {!compact && amount !== undefined ? (
        <Text style={[styles.amount, { color: amountColor }]}>{amount}</Text>
      ) : null}
      {meta ? <Text style={styles.meta}>{meta}</Text> : null}
      {!compact && progress !== undefined && (
        <View style={styles.track}>
          <View
            style={[
              styles.fillBar,
              { backgroundColor: shade(hue, 46), width: `${Math.min(100, Math.max(0, progress * 100))}%` },
            ]}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 22,
    padding: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: theme.colors.glass,
    backgroundColor: theme.colors.surface,
    marginBottom: 12,
  },
  compact: { padding: 12, borderColor: theme.colors.borderSoft },
  top: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  heading: { flex: 1, minWidth: 0, gap: 3 },
  icon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  kicker: { fontFamily: theme.font.body, fontSize: 12, lineHeight: 18, color: theme.colors.textSecondary },
  amount: {
    fontFamily: theme.font.bodyMedium,
    fontSize: 28,
    lineHeight: 36,
    marginTop: 10,
    fontVariant: ['tabular-nums'],
  },
  title: { fontFamily: theme.font.bodyBold, fontSize: 15, color: theme.colors.textPrimary },
  meta: {
    fontFamily: theme.font.body,
    fontSize: 12,
    lineHeight: 18,
    color: theme.colors.textSecondary,
    marginTop: 4,
  },
  track: {
    height: 6,
    borderRadius: 3,
    backgroundColor: theme.colors.inkWash,
    marginTop: 12,
    overflow: 'hidden',
  },
  fillBar: { height: '100%', borderRadius: 3, backgroundColor: theme.colors.ink },
});
