import { Pressable, StyleSheet, View } from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import Feather from '@expo/vector-icons/Feather';
import { Text } from '@/components/Text';
import { theme } from '@/constants/theme';
import type { McIconName } from '@/components/iconName';
import { withPressedTint } from '@/lib/pressed';
import { useAccent } from '@/theme/AccentContext';
import { useStacked } from '@/lib/useStacked';
import { GrowFill } from '@/components/GrowFill';

/** Compact budget/goal row; large text moves its amount below the name instead of truncating it. */
export function PlanSummaryRow({
  name,
  subtitle,
  amount,
  icon,
  progress,
  animKey,
  color,
  accessibilityLabel,
  onPress,
}: {
  name: string;
  subtitle: string;
  amount: string;
  icon: McIconName;
  progress?: number;
  /** Which bar this is (`plan:budget-row:<id>`): it keeps what it last showed and glides to a new value. */
  animKey: string;
  color: string;
  accessibilityLabel: string;
  onPress: () => void;
}) {
  const stacked = useStacked();
  const { accent } = useAccent();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={withPressedTint(accent, s.row)}
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
            <GrowFill animKey={animKey} pct={progress} style={[s.fill, { backgroundColor: color }]} />
          </View>
        )}
      </View>
      <Feather name="chevron-right" size={14} color={theme.colors.textMuted} />
    </Pressable>
  );
}

/** Footer belongs to its list surface, with a full-height touch target and no extra pill. */
export function PlanListAdd({ label, onPress }: { label: string; onPress: () => void }) {
  const { accent } = useAccent();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={withPressedTint(accent, s.add)}
    >
      <Feather name="plus" size={15} color={theme.colors.link} />
      <Text style={s.addText}>{label}</Text>
    </Pressable>
  );
}

export const summaryListStyle = {
  marginHorizontal: 16,
  paddingHorizontal: 14,
  borderRadius: 22,
  backgroundColor: theme.colors.surface,
  borderWidth: StyleSheet.hairlineWidth,
  borderColor: theme.colors.borderSoft,
};
const s = StyleSheet.create({
  add: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.borderSoft,
    marginTop: 4,
  },
  addText: { fontFamily: theme.font.bodyMedium, fontSize: 13, color: theme.colors.link },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, minHeight: 52 },
  icon: {
    width: 32,
    height: 32,
    borderRadius: 11,
    backgroundColor: theme.colors.primaryTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: { flex: 1, minWidth: 0, gap: 5 },
  line: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  stacked: { flexDirection: 'column', alignItems: 'flex-start', gap: 5 },
  copy: { flex: 1, minWidth: 0, gap: 2 },
  name: { fontFamily: theme.font.bodyMedium, fontSize: 14, lineHeight: 20, color: theme.colors.textPrimary },
  subtitle: { fontFamily: theme.font.body, fontSize: 12, lineHeight: 17, color: theme.colors.textSecondary },
  amount: {
    fontFamily: theme.font.bodyMedium,
    fontSize: 14,
    lineHeight: 20,
    flexShrink: 1,
    fontVariant: ['tabular-nums'],
  },
  track: { height: 4, borderRadius: 2, backgroundColor: theme.colors.surfaceAlt, overflow: 'hidden' },
  fill: { height: 4, borderRadius: 2 },
});
