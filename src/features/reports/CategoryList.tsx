import { View, Pressable, ActivityIndicator } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { Text } from '@/components/Text';
import { Amount } from '@/components/Amount';
import { CategoryBreakdownItem } from '@/db/reports';
import { formatPctChange } from '@/lib/format';
import { allocateRoundedMinor, roundedMinor } from '@/lib/round';
import { theme } from '@/constants/theme';
import { AnimatedCategoryFill } from './AnimatedCategoryFill';
import { styles } from './reports.styles';
import { withPressed } from '@/lib/pressed';

/** Categories shown before "N more" — like every other long list in the app. */
const COLLAPSED_COUNT = 5;
/** A change smaller than this (in %) against the previous period isn't worth an arrow. */
const DELTA_MIN_PCT = 10;
/** Stagger each bar's fill a little, capped so a long list doesn't lag. */
const FILL_STAGGER_MS = 60;
const FILL_STAGGER_MAX_ROWS = 8;

/**
 * "Where it went": each category's share, amount, change vs the previous period, and a bar. Tapping a row
 * picks it (others fade), opening its subcategory split and links to its page and (spending) its heatmap days.
 */
export function CategoryList({
  breakdown,
  spentMinor,
  deltas,
  expanded,
  onToggleExpanded,
  selectedId,
  onSelect,
  split,
  splitCaption,
  onOpen,
  onShowDays,
  kind = 'expense',
}: {
  breakdown: CategoryBreakdownItem[];
  /** The period's rounded total — the rows' rounded amounts add up to it. */
  spentMinor: number;
  /** % change per category id against the previous period. */
  deltas: Map<string, number | null>;
  expanded: boolean;
  onToggleExpanded: () => void;
  selectedId: string | null;
  onSelect: (c: CategoryBreakdownItem) => void;
  /** The picked category's subcategories; null while they load. */
  split: CategoryBreakdownItem[] | null;
  /** A small line above the split rows ("Top categories"), when the split isn't subcategories. */
  splitCaption?: string;
  /** Opens the row's own page; left out where it has none (an account outside a month view). */
  onOpen?: (c: CategoryBreakdownItem) => void;
  /** Shows the category's days on the heatmap; left out where the heatmap has no days (income, by-month views). */
  onShowDays?: (c: CategoryBreakdownItem) => void;
  /** Income: a rise is good news, so it's green rather than red. */
  kind?: 'expense' | 'income';
}) {
  const upIsBad = kind === 'expense';
  const shown = expanded ? breakdown : breakdown.slice(0, COLLAPSED_COUNT);
  const rounded = allocateRoundedMinor(
    breakdown.map((c) => c.totalMinor),
    spentMinor
  );
  const maxCat = Math.max(1, ...breakdown.map((c) => c.totalMinor));
  return (
    <View style={styles.catCard}>
      {shown.map((c, i) => {
        const d = deltas.get(c.categoryId);
        const pct = spentMinor > 0 ? Math.round((c.totalMinor / spentMinor) * 100) : 0;
        const on = selectedId === c.categoryId;
        return (
          <View key={c.categoryId}>
            <Pressable
              onPress={() => onSelect(c)}
              style={withPressed([
                styles.catRow,
                on && styles.catRowOn,
                selectedId != null && !on && styles.catRowDim,
              ])}
              accessibilityRole="button"
              accessibilityState={{ selected: on, expanded: on }}
            >
              <View style={styles.catTop}>
                <View style={[styles.catDot, { backgroundColor: c.color }]} />
                <Text style={styles.catName} numberOfLines={1}>
                  {c.name}
                </Text>
                <Text style={styles.catPct}>{pct}%</Text>
                <View style={styles.catRight}>
                  <Amount minor={rounded[i]} sensitive={c.isSensitive} style={styles.catAmt} />
                  {d != null && Math.abs(d) >= DELTA_MIN_PCT && (
                    <Text
                      style={[
                        styles.catDelta,
                        { color: d > 0 === upIsBad ? theme.colors.expenseText : theme.colors.incomeText },
                      ]}
                    >
                      {d > 0 ? '↑' : '↓'}
                      {formatPctChange(d)}
                    </Text>
                  )}
                </View>
              </View>
              <View style={styles.catTrack}>
                <AnimatedCategoryFill
                  animKey={`reports:${c.categoryId}`}
                  targetPct={Math.max(3, (c.totalMinor / maxCat) * 100)}
                  color={c.color}
                  delay={Math.min(i, FILL_STAGGER_MAX_ROWS) * FILL_STAGGER_MS}
                />
              </View>
            </Pressable>

            {on && (
              <View style={styles.catPanel}>
                {c.hasSubcategories &&
                  (split === null ? (
                    <ActivityIndicator color={theme.colors.ink} style={styles.catSplitLoading} />
                  ) : (
                    [
                      splitCaption ? (
                        <Text key="caption" style={styles.catSplitCaption}>
                          {splitCaption}
                        </Text>
                      ) : null,
                      ...split.map((s) => (
                        <View key={s.categoryId} style={styles.catSplitRow}>
                          <View style={[styles.catDot, { backgroundColor: s.color }]} />
                          <Text style={styles.catSplitName} numberOfLines={1}>
                            {s.name}
                          </Text>
                          <Text style={styles.catPct}>
                            {c.totalMinor > 0 ? Math.round((s.totalMinor / c.totalMinor) * 100) : 0}%
                          </Text>
                          <Amount
                            minor={roundedMinor(s.totalMinor)}
                            sensitive={s.isSensitive}
                            style={styles.catSplitAmt}
                          />
                        </View>
                      )),
                    ]
                  ))}
                {(onOpen || onShowDays) && (
                  <View style={styles.catLinks}>
                    {onOpen && (
                      <Pressable
                        onPress={() => onOpen(c)}
                        hitSlop={6}
                        style={withPressed(styles.catLink)}
                        accessibilityRole="link"
                      >
                        <Text style={styles.catLinkText}>Open {c.name} ›</Text>
                      </Pressable>
                    )}
                    {onShowDays && (
                      <Pressable
                        onPress={() => onShowDays(c)}
                        hitSlop={6}
                        style={withPressed(styles.catLink)}
                        accessibilityRole="link"
                      >
                        <Text style={styles.catLinkText}>See its days on the heatmap →</Text>
                      </Pressable>
                    )}
                  </View>
                )}
              </View>
            )}
          </View>
        );
      })}
      {breakdown.length > COLLAPSED_COUNT && (
        <Pressable
          onPress={onToggleExpanded}
          style={withPressed(styles.catMore)}
          accessibilityRole="button"
          accessibilityLabel={
            expanded ? 'Show fewer categories' : `Show ${breakdown.length - COLLAPSED_COUNT} more categories`
          }
        >
          <Text style={styles.catMoreText}>
            {expanded ? 'Show less' : `${breakdown.length - COLLAPSED_COUNT} more`}
          </Text>
          <Feather name={expanded ? 'chevron-up' : 'chevron-down'} size={14} color={theme.colors.textMuted} />
        </Pressable>
      )}
    </View>
  );
}
