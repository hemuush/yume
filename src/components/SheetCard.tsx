import { View, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Text } from '@/components/Text';
import { theme } from '@/constants/theme';
import { shade } from '@/lib/color';
import type { McIconName } from '@/components/iconName';

/**
 * Compact sheet summary: category colour stays in the icon and edge, while the amount and context
 * remain readable. Forms keep their live preview without repeating a full hero banner.
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
  softAccent = false,
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
  softAccent?: boolean;
}) {
  return (
    <View
      style={[
        styles.card,
        softAccent
          ? { borderLeftWidth: StyleSheet.hairlineWidth, borderColor: shade(hue, 80) }
          : { borderLeftColor: shade(hue, 65) },
        style,
      ]}
    >
      <View style={styles.top}>
        <View
          style={[
            styles.icon,
            softAccent && { width: 40, height: 40, borderRadius: 20 },
            { backgroundColor: shade(hue, 92) },
          ]}
        >
          <MaterialCommunityIcons name={icon as McIconName} size={18} color={shade(hue, 30, 10)} />
        </View>
        <View style={styles.heading}>
          <Text style={styles.title}>{title}</Text>
          {kicker ? <Text style={styles.kicker}>{kicker}</Text> : null}
        </View>
      </View>
      {amount !== undefined ? <Text style={[styles.amount, { color: amountColor }]}>{amount}</Text> : null}
      {meta ? <Text style={styles.meta}>{meta}</Text> : null}
      {progress !== undefined && (
        <View style={styles.track}>
          <View style={[styles.fillBar, { width: `${Math.min(100, Math.max(0, progress * 100))}%` }]} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 18,
    padding: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.borderSoft,
    borderLeftWidth: 3,
    backgroundColor: theme.colors.surface,
    marginBottom: 12,
  },
  top: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  heading: { flex: 1, minWidth: 0, gap: 3 },
  icon: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  kicker: { fontFamily: theme.font.body, fontSize: 12, lineHeight: 18, color: theme.colors.textSecondary },
  amount: {
    fontFamily: theme.font.bodyMedium,
    fontSize: 24,
    lineHeight: 32,
    marginTop: 6,
    fontVariant: ['tabular-nums'],
  },
  title: { fontFamily: theme.font.bodyBold, fontSize: 16, color: theme.colors.textPrimary },
  meta: {
    fontFamily: theme.font.body,
    fontSize: 12,
    lineHeight: 18,
    color: theme.colors.textSecondary,
    marginTop: 4,
  },
  track: {
    height: 5,
    borderRadius: 3,
    backgroundColor: theme.colors.inkWash,
    marginTop: 12,
    overflow: 'hidden',
  },
  fillBar: { height: '100%', borderRadius: 3, backgroundColor: theme.colors.ink },
});
