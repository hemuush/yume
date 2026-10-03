import { View, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Text } from '@/components/Text';
import { CountUpAmount } from '@/components/CountUpAmount';
import { GrowFill } from '@/components/GrowFill';
import { theme } from '@/constants/theme';
import { EYEBROW } from '@/constants/textStyles';
import { shade } from '@/lib/color';
import { formatMoney } from '@/lib/money';
import type { BudgetsHeroFigures, BudgetsTone } from './budgetsOverview';

const HUE: Record<BudgetsTone, string> = {
  ok: theme.colors.idSage,
  ahead: theme.colors.idGold,
  over: theme.colors.idCoral,
};

function Chip({ bold, rest }: { bold: string; rest?: string }) {
  return (
    <View style={styles.chip}>
      <Text style={styles.chipText} numberOfLines={1}>
        <Text style={styles.chipBold}>{bold}</Text>
        {rest ? ` ${rest}` : ''}
      </Text>
    </View>
  );
}

function status(h: BudgetsHeroFigures): string {
  if (h.overCount > 0) return `${h.overCount} over`;
  if (h.aheadCount > 0) return `${h.aheadCount} ahead`;
  return 'On track';
}

/**
 * First block on Budgets: what's left across all limits this month, the per-day allowance, and whether
 * spending keeps to the even line (ink tick). Tint warms to gold when ahead of pace, coral once over.
 */
export function BudgetsHero({ figures: h }: { figures: BudgetsHeroFigures }) {
  const hue = HUE[h.tone];
  const over = h.spentMinor > h.limitMinor;
  const sub = [
    `of ${formatMoney(h.limitMinor)}`,
    h.daysLeft === 0 ? 'last day' : `${h.daysLeft} ${h.daysLeft === 1 ? 'day' : 'days'} left`,
    `${h.budgetCount} ${h.budgetCount === 1 ? 'category' : 'categories'}`,
  ].join(' · ');

  return (
    <View style={styles.card}>
      <LinearGradient
        colors={[shade(hue, 93), shade(hue, 85)]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.circle} />
      <Text style={styles.kicker}>{over ? 'Over this month' : 'Left this month'}</Text>
      <CountUpAmount
        minor={over ? h.overMinor : h.leftMinor}
        countFromZero={false}
        style={styles.amount}
        numberOfLines={1}
        adjustsFontSizeToFit
      />
      <Text style={styles.sub} numberOfLines={1}>
        {sub}
      </Text>
      <View style={styles.trackWrap}>
        <View style={styles.track}>
          <GrowFill animKey="budgets:hero" pct={h.usedPct} style={styles.fill} />
        </View>
        <View style={[styles.marker, { left: `${Math.min(100, h.expectedPct)}%` }]} />
      </View>
      <View style={styles.chips}>
        {h.perDayMinor != null && <Chip bold={formatMoney(h.perDayMinor)} rest="a day" />}
        <Chip bold={formatMoney(h.spentMinor)} rest="spent" />
        <Chip bold={status(h)} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 20,
    marginTop: theme.layout.screenTopGap,
    padding: 16,
    borderRadius: theme.radius.xl2,
    overflow: 'hidden',
  },
  circle: {
    position: 'absolute',
    right: -34,
    top: -46,
    width: 130,
    height: 130,
    borderRadius: 65,
    backgroundColor: 'rgba(255,255,255,0.35)',
  },
  kicker: { ...EYEBROW, color: theme.colors.textSecondary },
  amount: { fontFamily: theme.font.monoBold, fontSize: 28, color: theme.colors.textPrimary, marginTop: 4 },
  sub: { fontFamily: theme.font.body, fontSize: 12.5, color: theme.colors.textSecondary, marginTop: 2 },
  trackWrap: { marginTop: 14, justifyContent: 'center' },
  track: {
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.6)',
    overflow: 'hidden',
  },
  fill: { height: '100%', borderRadius: 3, backgroundColor: theme.colors.ink },
  marker: {
    position: 'absolute',
    top: -3,
    bottom: -3,
    width: 2,
    marginLeft: -1,
    borderRadius: 1,
    backgroundColor: theme.colors.ink,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 12 },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: theme.radius.pill,
    backgroundColor: 'rgba(255,255,255,0.6)',
  },
  chipText: { fontFamily: theme.font.body, fontSize: 12, color: theme.colors.textSecondary },
  chipBold: { fontFamily: theme.font.bodyBold, color: theme.colors.textPrimary },
});
