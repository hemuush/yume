import { SpendingExplanation } from './SpendingExplanation';
import { DateRange } from '@/types';
import { View, Pressable, ActivityIndicator } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { CategoryIcon } from '@/components/CategoryIcon';
import { Text } from '@/components/Text';
import { Amount } from '@/components/Amount';
import { ModalSheet } from '@/components/ModalSheet';
import type { CategoryBreakdownItem } from '@/db/reports';
import { formatPctChange } from '@/lib/format';
import { allocateRoundedMinor, roundedMinor } from '@/lib/round';
import { theme } from '@/constants/theme';
import { GrowFill } from '@/components/GrowFill';
import { styles } from './reports.styles';
import { shade } from '@/lib/color';
import { withPressed, withPressedTint } from '@/lib/pressed';
import { useAccent } from '@/theme/AccentContext';

const COLLAPSED_COUNT = 5;
const DELTA_MIN_PCT = 10;

/** Aligned category/account rows; details open in one sheet without dimming the report. */
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
  iconOf,
  splitError,
  onRetrySplit,
  currentRange,
  previousRange,
}: {
  breakdown: CategoryBreakdownItem[];
  spentMinor: number;
  deltas: Map<string, number | null>;
  expanded: boolean;
  onToggleExpanded: () => void;
  selectedId: string | null;
  onSelect: (row: CategoryBreakdownItem) => void;
  split: CategoryBreakdownItem[] | null;
  splitCaption?: string;
  onOpen?: (row: CategoryBreakdownItem) => void;
  onShowDays?: (row: CategoryBreakdownItem) => void;
  kind?: 'expense' | 'income';
  iconOf?: (id: string) => string | undefined;
  splitError?: string;
  onRetrySplit?: () => void;
  currentRange?: DateRange;
  previousRange?: DateRange;
}) {
  const { accent } = useAccent();
  const shown = expanded ? breakdown : breakdown.slice(0, COLLAPSED_COUNT);
  const rounded = allocateRoundedMinor(
    breakdown.map((row) => row.totalMinor),
    spentMinor
  );
  const selected = breakdown.find((row) => row.categoryId === selectedId);
  const close = () => {
    if (selected) onSelect(selected);
  };
  return (
    <>
      <View style={styles.catCard}>
        {shown.map((row, i) => {
          const delta = deltas.get(row.categoryId);
          const share = spentMinor > 0 ? Math.max(0, Math.min(100, (row.totalMinor / spentMinor) * 100)) : 0;
          const icon = iconOf?.(row.categoryId);
          return (
            <Pressable
              key={row.categoryId}
              onPress={() => onSelect(row)}
              style={withPressedTint(accent, styles.catRow)}
              accessibilityRole="button"
              accessibilityLabel={`${row.name}. Open breakdown`}
              accessibilityState={{ selected: selectedId === row.categoryId }}
            >
              {icon ? (
                <CategoryIcon name={icon} color={row.color} size={16} square={32} round />
              ) : (
                <View style={[styles.catDot, { backgroundColor: row.color }]} />
              )}
              <View style={styles.catMain}>
                <Text style={styles.catName}>{row.name}</Text>
                <View style={styles.catMeta}>
                  <Text style={styles.stripSub}>{Math.round(share)}% of total</Text>
                  {delta != null && Math.abs(delta) >= DELTA_MIN_PCT && (
                    <Text
                      style={[
                        styles.catDelta,
                        {
                          color:
                            delta > 0 === (kind === 'expense')
                              ? theme.colors.expenseText
                              : theme.colors.incomeText,
                        },
                      ]}
                    >
                      {delta > 0 ? '↑' : '↓'}
                      {formatPctChange(delta)}
                    </Text>
                  )}
                </View>
                <View style={styles.catTrack}>
                  <GrowFill
                    animKey={`reports:${row.categoryId}`}
                    pct={share}
                    style={{ height: '100%', borderRadius: 4, backgroundColor: row.color }}
                  />
                </View>
              </View>
              <View style={styles.catRight}>
                <Amount
                  minor={rounded[i]}
                  sensitive={row.isSensitive}
                  style={styles.catAmt}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.8}
                />
                <Feather name="chevron-right" size={14} color={theme.colors.textMuted} />
              </View>
            </Pressable>
          );
        })}
        {breakdown.length > COLLAPSED_COUNT && (
          <Pressable
            onPress={onToggleExpanded}
            style={withPressedTint(accent, styles.catMore)}
            accessibilityRole="button"
            accessibilityLabel={
              expanded
                ? 'Show fewer categories'
                : `Show ${breakdown.length - COLLAPSED_COUNT} more categories`
            }
          >
            <Text style={styles.catMoreText}>{expanded ? 'Show less' : `View all ${breakdown.length}`}</Text>
            <Feather
              name={expanded ? 'chevron-up' : 'chevron-down'}
              size={14}
              color={theme.colors.textMuted}
            />
          </Pressable>
        )}
      </View>
      <ModalSheet
        visible={!!selected}
        onClose={close}
        title={selected?.name}
        subtitle={kind === 'income' ? 'Income breakdown' : 'Spending breakdown'}
      >
        {selected && (
          <>
            <View style={[styles.breakdownSummary, { backgroundColor: shade(selected.color, 94) }]}>
              <CategoryIcon name={iconOf?.(selected.categoryId) ?? 'tag'} color={selected.color} />
              <View style={styles.catMain}>
                <Text style={styles.catSplitCaption}>
                  {kind === 'income' ? 'Total income' : 'Total spending'}
                </Text>
                <Amount
                  minor={rounded[breakdown.indexOf(selected)]}
                  sensitive={selected.isSensitive}
                  style={styles.breakdownAmount}
                />
              </View>
            </View>
            {splitError ? (
              <View style={styles.tidyNudge}>
                <Text style={styles.errTitle}>Couldn’t load this breakdown</Text>
                <Text style={styles.errDetail}>{splitError}</Text>
                <Pressable
                  onPress={onRetrySplit}
                  accessibilityRole="button"
                  style={withPressed(styles.catLink)}
                >
                  <Text style={styles.catLinkText}>Retry breakdown</Text>
                </Pressable>
              </View>
            ) : (
              selected.hasSubcategories &&
              (split === null ? (
                <ActivityIndicator
                  accessibilityLabel="Loading breakdown"
                  color={theme.colors.ink}
                  style={styles.catSplitLoading}
                />
              ) : (
                <View>
                  <Text style={styles.breakdownHeading}>By subcategory</Text>
                  {splitCaption && <Text style={styles.catSplitCaption}>{splitCaption}</Text>}
                  {split.map((row) => (
                    <View key={row.categoryId} style={styles.catSplitRow}>
                      <View style={[styles.catDot, { backgroundColor: row.color }]} />
                      <Text style={styles.catSplitName}>{row.name}</Text>
                      <Text style={styles.catPct}>
                        {selected.totalMinor > 0
                          ? Math.round((row.totalMinor / selected.totalMinor) * 100)
                          : 0}
                        %
                      </Text>
                      <Amount
                        minor={roundedMinor(row.totalMinor)}
                        sensitive={row.isSensitive}
                        style={styles.catSplitAmt}
                      />
                    </View>
                  ))}
                </View>
              ))
            )}
            {kind === 'expense' && currentRange && previousRange && (
              <SpendingExplanation
                categoryId={selected.categoryId}
                current={currentRange}
                previous={previousRange}
                onBeforeEntry={close}
              />
            )}
            <View style={styles.catLinks}>
              {onOpen && (
                <Pressable
                  onPress={() => {
                    close();
                    onOpen(selected);
                  }}
                  accessibilityRole="link"
                  style={withPressed(styles.catLink)}
                >
                  <Text style={styles.catLinkText}>Open {selected.name} ›</Text>
                </Pressable>
              )}
              {onShowDays && (
                <Pressable
                  onPress={() => {
                    close();
                    onShowDays(selected);
                  }}
                  accessibilityRole="link"
                  style={withPressed(styles.catLink)}
                >
                  <Text style={styles.catLinkText}>See its days on the heatmap →</Text>
                </Pressable>
              )}
            </View>
          </>
        )}
      </ModalSheet>
    </>
  );
}
