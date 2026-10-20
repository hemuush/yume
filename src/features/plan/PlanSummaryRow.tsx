import { Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import Feather from '@expo/vector-icons/Feather';
import { Text } from '@/components/Text';
import { theme } from '@/constants/theme';
import type { McIconName } from '@/components/iconName';
import { withPressed } from '@/lib/pressed';

/** Compact budget/goal row; large text moves its amount below the name instead of truncating it. */
export function PlanSummaryRow({
  name,
  subtitle,
  amount,
  icon,
  progress,
  color,
  accessibilityLabel,
  onPress,
}: {
  name: string;
  subtitle: string;
  amount: string;
  icon: McIconName;
  progress?: number;
  color: string;
  accessibilityLabel: string;
  onPress: () => void;
}) {
  const { width, fontScale } = useWindowDimensions();
  const stacked = width < 360 || fontScale > 1.2;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={withPressed(s.row)}
    >
      <View style={s.icon}>
        <MaterialCommunityIcons name={icon} size={18} color={color} />
      </View>
      <View style={s.content}>
        <View style={[s.line, stacked && s.stacked]}>
          <View style={s.copy}>
            <Text style={s.name}>{name}</Text>
            <Text style={s.subtitle}>{subtitle}</Text>
          </View>
          <Text style={[s.amount, { color }]}>{amount}</Text>
        </View>
        {progress !== undefined && (
          <View style={s.track} accessible={false}>
            <View
              style={[s.fill, { width: `${Math.max(0, Math.min(100, progress))}%`, backgroundColor: color }]}
            />
          </View>
        )}
      </View>
      <Feather name="chevron-right" size={14} color={theme.colors.textMuted} />
    </Pressable>
  );
}

export const summaryListStyle = {
  marginHorizontal: 16,
  paddingHorizontal: 14,
  borderRadius: 22,
  backgroundColor: theme.colors.surface,
};
const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, minHeight: 68 },
  icon: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: theme.colors.primaryTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: { flex: 1, minWidth: 0, gap: 8 },
  line: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  stacked: { flexDirection: 'column', alignItems: 'flex-start', gap: 5 },
  copy: { flex: 1, minWidth: 0, gap: 3 },
  name: { fontFamily: theme.font.bodyMedium, fontSize: 13, color: theme.colors.textPrimary },
  subtitle: { fontFamily: theme.font.body, fontSize: 11, color: theme.colors.textSecondary },
  amount: { fontFamily: theme.font.bodyMedium, fontSize: 13, flexShrink: 1, fontVariant: ['tabular-nums'] },
  track: { height: 4, borderRadius: 2, backgroundColor: theme.colors.surfaceAlt, overflow: 'hidden' },
  fill: { height: 4, borderRadius: 2 },
});
