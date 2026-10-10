import { useEffect, useState } from 'react';
import { View, Pressable, StyleSheet, useWindowDimensions } from 'react-native';
import Animated, {
  cancelAnimation,
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from 'react-native-reanimated';
import Feather from '@expo/vector-icons/Feather';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Text } from '@/components/Text';
import type { McIconName } from '@/components/iconName';
import type { CategoryBreakdownItem } from '@/db/reports';
import { theme } from '@/constants/theme';
import { formatMoney } from '@/lib/money';
import { haptics } from '@/lib/haptics';
import { withPressed } from '@/lib/pressed';
import { timing } from '@/lib/animation';
import { useReduceMotion } from '@/lib/useReduceMotion';
import { useAccent } from '@/theme/AccentContext';
import { homeInk } from './homeInk';

const POSITIONS = [
  [78, 0],
  [100, 46],
  [110, 92],
  [100, 138],
  [78, 184],
] as const;

/** Fixed curved targets; only the selection pill moves, while details update immediately. */
export function WhereItWent({
  breakdown,
  iconFor,
  spentMinor,
  previousSpentMinor,
  periodName,
  previousName,
  onOpenReports,
  onOpenCategory,
  onAddExpense,
}: {
  breakdown: CategoryBreakdownItem[];
  iconFor: (categoryId: string) => string | undefined;
  spentMinor: number;
  previousSpentMinor: number;
  periodName: string;
  previousName: string;
  onOpenReports: () => void;
  onOpenCategory?: (categoryId: string) => void;
  onAddExpense?: () => void;
}) {
  const positive = breakdown.filter((c) => c.totalMinor > 0).sort((a, b) => b.totalMinor - a.totalMinor);
  const top = positive.slice(0, 4);
  const total = positive.reduce((sum, c) => sum + c.totalMinor, 0);
  const [picked, setPicked] = useState(top[0]?.categoryId);
  const index = Math.max(
    0,
    top.findIndex((c) => c.categoryId === picked)
  );
  const selected = top[index];
  const share = selected ? Math.round((selected.totalMinor / total) * 100) : 0;
  const reduce = useReduceMotion();
  const { fontScale } = useWindowDimensions();
  const { accent } = useAccent();
  const ink = homeInk(accent);
  const x = useSharedValue(POSITIONS[index][0] - 38);
  const y = useSharedValue(POSITIONS[index][1]);
  useEffect(() => {
    x.value = reduce ? POSITIONS[index][0] - 38 : withTiming(POSITIONS[index][0] - 38, timing(200));
    y.value = reduce ? POSITIONS[index][1] : withTiming(POSITIONS[index][1], timing(200));
    return () => {
      cancelAnimation(x);
      cancelAnimation(y);
    };
  }, [index, reduce, x, y]);
  const highlight = useAnimatedStyle(() => ({
    transform: [{ translateX: x.value }, { translateY: y.value }],
  }));
  const diff = spentMinor - previousSpentMinor;
  return (
    <View style={[styles.section, { minHeight: fontScale > 1.1 ? 290 : 236 }]}>
      <View style={styles.details}>
        <Text style={styles.label}>Spent in {periodName}</Text>
        <Text style={styles.total} numberOfLines={1} adjustsFontSizeToFit>
          {formatMoney(spentMinor)}
        </Text>
        {previousSpentMinor > 0 && diff !== 0 && (
          <Text style={styles.meta}>
            {formatMoney(Math.abs(diff))} {diff < 0 ? 'less' : 'more'} than {previousName}
          </Text>
        )}
        <View style={styles.divider} />
        <Text style={styles.name}>{selected?.name ?? 'No spending yet'}</Text>
        <Text style={styles.meta}>
          {selected
            ? `${formatMoney(selected.totalMinor)} · ${share}% of spending`
            : 'Your categories appear after an expense.'}
        </Text>
        <Pressable
          style={withPressed(styles.linkButton)}
          onPress={selected ? () => onOpenCategory?.(selected.categoryId) : onAddExpense}
          accessibilityRole="button"
          accessibilityLabel={selected ? `View ${selected.name} category` : 'Add expense'}
        >
          <Text style={styles.link}>{selected ? 'View category' : 'Add expense'}</Text>
          <Feather name="arrow-right" size={16} color={theme.colors.link} />
        </Pressable>
      </View>
      {selected && (
        <View style={styles.dial}>
          <Animated.View pointerEvents="none" style={[styles.highlight, { backgroundColor: ink }, highlight]}>
            <Text style={styles.share}>{share}%</Text>
          </Animated.View>
          {top.map((c, i) => (
            <Pressable
              key={c.categoryId}
              style={withPressed([
                styles.target,
                {
                  left: POSITIONS[i][0],
                  top: POSITIONS[i][1],
                  backgroundColor: i === index ? 'transparent' : theme.colors.white,
                },
              ])}
              onPress={() => {
                if (c.categoryId !== selected.categoryId) {
                  haptics.tap();
                  setPicked(c.categoryId);
                }
              }}
              accessibilityRole="button"
              accessibilityLabel={`${c.name}, ${Math.round((c.totalMinor / total) * 100)}% of spending`}
              accessibilityState={{ selected: i === index }}
            >
              <MaterialCommunityIcons
                name={(iconFor(c.categoryId) ?? 'tag') as McIconName}
                size={20}
                color={i === index ? theme.colors.white : ink}
              />
            </Pressable>
          ))}
          <Pressable
            style={withPressed([styles.target, { left: POSITIONS[4][0], top: POSITIONS[4][1] }])}
            onPress={onOpenReports}
            accessibilityRole="button"
            accessibilityLabel="All categories in Reports"
          >
            <Feather name="more-horizontal" size={20} color={ink} />
          </Pressable>
        </View>
      )}
    </View>
  );
}
const styles = StyleSheet.create({
  section: { marginHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 4 },
  details: { flex: 1, minWidth: 0, paddingVertical: 8 },
  dial: { width: 155, height: 228 },
  highlight: { position: 'absolute', width: 82, height: 44, borderRadius: 22, justifyContent: 'center' },
  share: {
    width: 38,
    textAlign: 'center',
    fontFamily: theme.font.bodyBold,
    fontSize: 11,
    color: theme.colors.white,
  },
  target: {
    position: 'absolute',
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.white,
  },
  label: { fontFamily: theme.font.bodyMedium, fontSize: 12.5, color: theme.colors.textMuted },
  total: {
    fontFamily: theme.font.bodyLight,
    fontSize: 28,
    lineHeight: 36,
    color: theme.colors.textPrimary,
    marginTop: 6,
  },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: theme.colors.borderSoft, marginVertical: 10 },
  name: { fontFamily: theme.font.bodyBold, fontSize: 14, color: theme.colors.textPrimary },
  meta: {
    fontFamily: theme.font.body,
    fontSize: 12,
    lineHeight: 18,
    color: theme.colors.textSecondary,
    marginTop: 4,
  },
  linkButton: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 6 },
  link: { flexShrink: 1, fontFamily: theme.font.bodyBold, fontSize: 12, color: theme.colors.link },
});
