import { useMemo } from 'react';
import { CONTENT_ENTER } from '@/lib/animation';
import { View, Pressable, StyleSheet } from 'react-native';
import Animated from 'react-native-reanimated';
import Feather from '@expo/vector-icons/Feather';
import { Text } from '@/components/Text';
import { theme } from '@/constants/theme';
import { formatMoney } from '@/lib/money';
import { roundedMinor } from '@/lib/round';
import { withPressedTint } from '@/lib/pressed';
import { useAccent } from '@/theme/AccentContext';
import { weekdayDayMonth } from '@/lib/dateLabels';
import type { Category, Transaction } from '@/types';

interface DayMixPart {
  id: string;
  name: string;
  color: string;
  minor: number;
}

/**
 * What a day's spending was made of: each expense rolled up to its top-level category, largest first.
 * Refunds and income are left out; the bar shows where the money went, not the net.
 */
function dayMix(txs: Transaction[], catById: Map<string, Category>): DayMixPart[] {
  const by = new Map<string, DayMixPart>();
  for (const tx of txs) {
    if (tx.type !== 'expense' || tx.amountMinor <= 0) continue;
    const own = tx.categoryId ? catById.get(tx.categoryId) : undefined;
    const top = own?.parentId ? (catById.get(own.parentId) ?? own) : own;
    const id = top?.id ?? 'none';
    const part = by.get(id) ?? {
      id,
      name: top?.name ?? 'Other',
      color: top?.color ?? theme.colors.textMuted,
      minor: 0,
    };
    part.minor += tx.amountMinor;
    by.set(id, part);
  }
  return [...by.values()].sort((a, b) => b.minor - a.minor);
}

/**
 * Under the heatmap: the day last touched, its spend against the period's usual day, what it was made of,
 * and a button to open its entries. `spentMinor` follows the heatmap's category colour when one is picked.
 */
export function DayInspector({
  iso,
  spentMinor,
  future,
  usualMinor,
  scopeName,
  txs,
  catById,
  onOpen,
}: {
  iso: string;
  spentMinor: number;
  future: boolean;
  usualMinor: number;
  scopeName?: string;
  /** The day's entries; null while they load. */
  txs: Transaction[] | null;
  catById: Map<string, Category>;
  onOpen: () => void;
}) {
  const { accent } = useAccent();
  const parts = useMemo(() => (txs ? dayMix(txs, catById) : []), [txs, catById]);
  const total = parts.reduce((s, p) => s + p.minor, 0);
  const ratio = usualMinor > 0 ? spentMinor / usualMinor : 0;
  const sub = future
    ? 'Hasn’t happened yet'
    : spentMinor <= 0
      ? 'A quiet day'
      : usualMinor > 0
        ? ratio < 0.05
          ? `A light day against your usual ${scopeName ? `${scopeName.toLowerCase()} ` : ''}day`
          : `${ratio.toFixed(1)}× your usual ${scopeName ? `${scopeName.toLowerCase()} ` : ''}day`
        : '';
  const date = weekdayDayMonth(iso);
  return (
    <Animated.View key={iso} entering={CONTENT_ENTER} style={styles.box}>
      <View style={styles.top}>
        <View style={styles.main}>
          <Text style={styles.date}>{date}</Text>
          <View style={styles.figure}>
            <Text style={styles.amount}>
              {future ? '—' : spentMinor > 0 ? formatMoney(roundedMinor(spentMinor)) : 'No spending'}
            </Text>
            {!!sub && <Text style={styles.sub}>{sub}</Text>}
          </View>
        </View>
        {!future && (
          <Pressable
            onPress={onOpen}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel={`Open ${date}`}
            style={withPressedTint(accent, styles.open)}
          >
            <Text style={styles.openText}>Open day</Text>
            <Feather name="chevron-right" size={14} color={theme.colors.link} />
          </Pressable>
        )}
      </View>
      {total > 0 && !scopeName && (
        <>
          <View
            style={styles.mixBar}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          >
            {parts.map((p) => (
              <View key={p.id} style={[styles.mixSeg, { flexGrow: p.minor, backgroundColor: p.color }]} />
            ))}
          </View>
          <View style={styles.mixText}>
            {parts.slice(0, 2).map((p) => (
              <View key={p.id} style={styles.mixItem}>
                <View style={[styles.mixDot, { backgroundColor: p.color }]} />
                <Text style={styles.mixLabel} numberOfLines={1}>
                  {p.name} <Text style={styles.mixAmount}>{formatMoney(roundedMinor(p.minor))}</Text>
                </Text>
              </View>
            ))}
          </View>
        </>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  box: {
    marginHorizontal: 12,
    marginTop: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 16,
    backgroundColor: theme.colors.tray,
  },
  top: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  main: { flex: 1, minWidth: 0 },
  date: { fontFamily: theme.font.bodyBold, fontSize: 12, color: theme.colors.textSecondary },
  amount: {
    fontFamily: theme.font.bodyMedium,
    fontSize: 16,
    lineHeight: 22,
    color: theme.colors.textPrimary,
    fontVariant: ['tabular-nums'],
  },
  figure: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', columnGap: 6 },
  sub: { flexShrink: 1, fontFamily: theme.font.body, fontSize: 12, color: theme.colors.textSecondary },
  open: {
    minHeight: 32,
    paddingHorizontal: 12,
    borderRadius: theme.radius.pill,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: theme.colors.surface,
  },
  openText: { fontFamily: theme.font.bodyBold, fontSize: 12, color: theme.colors.link },
  mixBar: { flexDirection: 'row', gap: 2, height: 6, marginTop: 8, borderRadius: 3, overflow: 'hidden' },
  mixSeg: {
    flexBasis: 0,
    minWidth: 3,
    borderRadius: 2,
    boxShadow: `inset 0px 0px 0px 1px ${theme.colors.inkHairline}`,
  },
  mixText: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 12, rowGap: 2, marginTop: 8 },
  mixItem: { flexDirection: 'row', alignItems: 'center', gap: 5, maxWidth: '100%' },
  mixDot: { width: 8, height: 8, borderRadius: 4 },
  mixLabel: { fontFamily: theme.font.body, fontSize: 12, color: theme.colors.textSecondary },
  mixAmount: { fontFamily: theme.font.bodyBold, color: theme.colors.textPrimary },
});
