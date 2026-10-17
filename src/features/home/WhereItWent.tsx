import { useEffect, useState } from 'react';
import { View, Pressable, StyleSheet, useWindowDimensions } from 'react-native';
import Animated, {
  cancelAnimation,
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import Feather from '@expo/vector-icons/Feather';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Text } from '@/components/Text';
import { cardSurface } from '@/components/CardSurface';
import { GLASS } from '@/components/Glass';
import type { McIconName } from '@/components/iconName';
import type { CategoryBreakdownItem } from '@/db/reports';
import { theme } from '@/constants/theme';
import { formatMoney } from '@/lib/money';
import { haptics } from '@/lib/haptics';
import { withPressed } from '@/lib/pressed';
import { useReduceMotion } from '@/lib/useReduceMotion';
import { useAccent } from '@/theme/AccentContext';
import { homeInk } from './homeInk';

/** One step down the curve; the targets are STEP tall (hitSlop brings the touch area back to 48). */
const STEP = 42;
const POSITIONS = [
  [38, 0],
  [54, STEP],
  [62, STEP * 2],
  [54, STEP * 3],
  [38, STEP * 4],
] as const;

/** The selection pill overshoots a touch and settles: it lands with a little life, not a slide. */
const PILL_SPRING = { damping: 13, stiffness: 190, mass: 0.9 };

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
  const { width, fontScale } = useWindowDimensions();
  const stacked = width < 360 || fontScale > 1.2;
  const { accent } = useAccent();
  const ink = homeInk(accent);
  const x = useSharedValue(POSITIONS[index][0] - 38);
  const y = useSharedValue(POSITIONS[index][1]);
  useEffect(() => {
    x.value = reduce ? POSITIONS[index][0] - 38 : withSpring(POSITIONS[index][0] - 38, PILL_SPRING);
    y.value = reduce ? POSITIONS[index][1] : withSpring(POSITIONS[index][1], PILL_SPRING);
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
    <View style={[styles.section, cardSurface.neutral, stacked && styles.stacked]}>
      <View style={styles.details}>
        <Text style={styles.label}>Spent in {periodName}</Text>
        <Text style={styles.total} numberOfLines={1} adjustsFontSizeToFit>
          {formatMoney(spentMinor)}
        </Text>
        {previousSpentMinor > 0 && diff !== 0 && (
          <Text
            style={[styles.meta, { color: diff < 0 ? theme.colors.incomeText : theme.colors.expenseText }]}
          >
            {formatMoney(Math.abs(diff))} {diff < 0 ? 'less' : 'more'} than {previousName}
          </Text>
        )}
        <View style={styles.divider} />
        {selected ? (
          // The category itself is the way in: no separate "View category" line.
          <Pressable
            style={withPressed(styles.categoryButton)}
            onPress={() => (onOpenCategory ? onOpenCategory(selected.categoryId) : onOpenReports())}
            accessibilityRole="button"
            accessibilityLabel={`View ${selected.name} category`}
          >
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.name}>{selected.name}</Text>
              <Text style={styles.meta}>{`${formatMoney(selected.totalMinor)} · ${share}%`}</Text>
            </View>
            <Feather name="chevron-right" size={18} color={theme.colors.link} />
          </Pressable>
        ) : (
          <>
            <Text style={styles.name}>{spentMinor < 0 ? 'Refunds exceed spending' : 'No spending yet'}</Text>
            <Text style={styles.meta}>
              {spentMinor < 0
                ? 'See your net spending and refunds in Reports.'
                : 'Your categories appear after an expense.'}
            </Text>
            <Pressable
              style={withPressed(styles.linkButton)}
              onPress={spentMinor < 0 ? onOpenReports : onAddExpense}
              accessibilityRole="button"
              accessibilityLabel={spentMinor < 0 ? 'View Reports' : 'Add expense'}
            >
              <Text style={styles.link}>{spentMinor < 0 ? 'View Reports' : 'Add expense'}</Text>
              <Feather name="arrow-right" size={16} color={theme.colors.link} />
            </Pressable>
          </>
        )}
      </View>
      {selected && (
        <View style={stacked ? styles.selectorRow : [styles.dial, { height: (top.length + 1) * STEP }]}>
          {!stacked && (
            <Animated.View
              pointerEvents="none"
              style={[styles.highlight, { backgroundColor: ink }, highlight]}
            >
              <Text style={styles.share}>{share}%</Text>
            </Animated.View>
          )}
          {top.map((c, i) => (
            <Pressable
              key={c.categoryId}
              style={withPressed([
                stacked ? styles.inlineTarget : styles.target,
                {
                  ...(stacked ? {} : { left: POSITIONS[i][0], top: POSITIONS[i][1] }),
                  backgroundColor: i === index ? (stacked ? ink : 'transparent') : theme.colors.white,
                },
              ])}
              onPress={() => {
                if (c.categoryId !== selected.categoryId) {
                  haptics.tap();
                  setPicked(c.categoryId);
                }
              }}
              hitSlop={3}
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
            style={withPressed(
              stacked
                ? styles.inlineTarget
                : [styles.target, { left: POSITIONS[top.length][0], top: POSITIONS[top.length][1] }]
            )}
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
  section: {
    marginHorizontal: 16,
    padding: 12,
    borderRadius: 24,
    backgroundColor: GLASS.fill,
    borderWidth: 1,
    borderColor: GLASS.edge,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  stacked: { flexDirection: 'column', alignItems: 'stretch' },
  selectorRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  inlineTarget: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.white,
  },
  details: { flex: 1, minWidth: 0 },
  dial: { width: 110 },
  highlight: {
    position: 'absolute',
    width: 82,
    height: STEP,
    borderRadius: STEP / 2,
    justifyContent: 'center',
  },
  share: {
    width: 34,
    textAlign: 'center',
    fontFamily: theme.font.bodyBold,
    fontSize: 11,
    color: theme.colors.white,
  },
  target: {
    position: 'absolute',
    width: STEP,
    height: STEP,
    borderRadius: STEP / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.white,
  },
  label: { fontFamily: theme.font.bodyMedium, fontSize: 12, color: theme.colors.textMuted },
  total: {
    fontFamily: theme.font.bodyLight,
    fontSize: 28,
    lineHeight: 36,
    fontVariant: ['tabular-nums'],
    color: theme.colors.textPrimary,
    marginTop: 6,
  },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: theme.colors.borderSoft, marginVertical: 10 },
  name: { fontFamily: theme.font.bodyBold, fontSize: 13, color: theme.colors.textPrimary },
  meta: {
    fontFamily: theme.font.body,
    fontSize: 12,
    lineHeight: 18,
    color: theme.colors.textSecondary,
    marginTop: 4,
  },
  categoryButton: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 6 },
  linkButton: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 6 },
  link: { flexShrink: 1, fontFamily: theme.font.bodyBold, fontSize: 12, color: theme.colors.link },
});
