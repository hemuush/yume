import { View, Text, Pressable, Animated, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Feather from '@expo/vector-icons/Feather';
import { theme } from '@/constants/theme';
import { formatMoney } from '@/lib/money';
import { usePressScale } from '@/lib/usePressScale';
import type { MonthReview } from './monthReview';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/**
 * Home's look back at the month that just ended (see monthReview.ts for when
 * it shows). The whole card opens that month's report; ✕ hides it until next
 * month. Soft wash between two existing pastel tints — inside the app's band.
 */
export function MonthInReviewCard({
  review,
  onOpen,
  onDismiss,
}: {
  review: MonthReview;
  onOpen: () => void;
  onDismiss: () => void;
}) {
  const { animatedStyle, onPressIn, onPressOut } = usePressScale(0.98);
  return (
    <AnimatedPressable
      onPress={onOpen}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      accessibilityRole="button"
      accessibilityLabel={`${review.monthLabel} in review: spent ${formatMoney(review.spentMinor)}. Opens ${review.monthLabel}'s report`}
      style={[styles.wrap, animatedStyle]}
    >
      <LinearGradient
        colors={[theme.colors.accentTint, theme.colors.secondaryTint]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.card}
      >
        <View style={styles.head}>
          <Text style={styles.title}>{review.monthLabel} in review</Text>
          <Pressable
            onPress={onDismiss}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Hide until next month"
            style={styles.close}
          >
            <Feather name="x" size={14} color={theme.colors.textMuted} />
          </Pressable>
        </View>
        <View style={styles.figs}>
          <Fig value={formatMoney(review.spentMinor)} label="SPENT" />
          <Fig value={review.keptLabel ?? '—'} label="KEPT" />
          <Fig value={review.topCategoryName ?? '—'} label="TOP" small />
        </View>
        {review.line && <Text style={styles.line}>{review.line}</Text>}
        <View style={styles.seeRow}>
          <Text style={styles.see}>See {review.monthLabel}&rsquo;s report</Text>
          <Feather name="chevron-right" size={14} color={theme.colors.textPrimary} />
        </View>
      </LinearGradient>
    </AnimatedPressable>
  );
}

function Fig({ value, label, small }: { value: string; label: string; small?: boolean }) {
  return (
    <View style={styles.fig}>
      <Text style={[styles.figValue, small && styles.figValueText]} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      <Text style={styles.figLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginHorizontal: 20, marginTop: 22 },
  card: { borderRadius: theme.radius.xl2, padding: 14, gap: 10 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontFamily: theme.font.roundedBold, fontSize: 16, color: theme.colors.textPrimary },
  close: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.glass,
  },
  figs: { flexDirection: 'row', gap: 8 },
  fig: {
    flex: 1,
    backgroundColor: theme.colors.glass,
    borderRadius: theme.radius.lg,
    paddingVertical: 8,
    paddingHorizontal: 6,
    alignItems: 'center',
  },
  figValue: { fontFamily: theme.font.monoBold, fontSize: 13, color: theme.colors.textPrimary },
  figValueText: { fontFamily: theme.font.bodyBold },
  figLabel: {
    fontFamily: theme.font.bodyBold,
    fontSize: 9,
    letterSpacing: 0.5,
    color: theme.colors.textMuted,
    marginTop: 2,
  },
  line: { fontFamily: theme.font.body, fontSize: 12.5, color: theme.colors.textPrimary, lineHeight: 17 },
  seeRow: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  see: { fontFamily: theme.font.bodyBold, fontSize: 12.5, color: theme.colors.textPrimary },
});
