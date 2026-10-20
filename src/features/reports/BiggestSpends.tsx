import { useState } from 'react';
import { View, Pressable } from 'react-native';
import { Text } from '@/components/Text';
import { Amount } from '@/components/Amount';
import { CategoryIcon } from '@/components/CategoryIcon';
import { parseLocalIsoDate } from '@/lib/date';
import { inParent, joinSub, parentNameOf } from '@/lib/categoryLabel';
import { theme } from '@/constants/theme';
import { withPressed } from '@/lib/pressed';
import type { LargestExpense } from '@/db/reports';
import type { Category } from '@/types';
import { styles } from './reports.styles';

/** Fewer entries than this and a "top 5" is just the list. */
const BIGGEST_MIN_ENTRIES = 3;

/**
 * The period's largest single expenses, in the day card's row; tapping one opens its day on the heatmap.
 * `shareOfMinor` is what the list's total is measured against ("Together 46% of what you've spent so far").
 */
export function BiggestSpends({
  items,
  catById,
  shareOfMinor,
  openIso,
  onOpenDay,
  inProgress,
  scopeName,
}: {
  items: LargestExpense[];
  catById: Map<string, Category>;
  shareOfMinor: number;
  /** The heatmap day currently open, marked in the list. */
  openIso: string | null;
  onOpenDay: (iso: string) => void;
  /** The period isn't over: "so far". */
  inProgress: boolean;
  /** The category the heatmap is narrowed to, when it is. */
  scopeName?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const shown = expanded ? items : items.slice(0, 3);
  if (items.length < BIGGEST_MIN_ENTRIES) return null;
  const together = shown.reduce((s, e) => s + e.amountMinor, 0);
  const share = shareOfMinor > 0 ? Math.min(100, Math.round((together / shareOfMinor) * 100)) : null;
  return (
    <View style={styles.bigBlock}>
      <View style={styles.storyHead}>
        <Text style={styles.blockTitle}>Biggest spends</Text>
        {items.length > 3 ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={expanded ? 'Show fewer biggest purchases' : 'View all biggest purchases'}
            onPress={() => setExpanded((v) => !v)}
            style={withPressed({ minHeight: 44, justifyContent: 'center', alignItems: 'flex-end' })}
          >
            <Text style={{ fontFamily: theme.font.bodyMedium, fontSize: 12, color: theme.colors.link }}>
              {expanded ? 'Show fewer' : `View all ${items.length}`}
            </Text>
          </Pressable>
        ) : (
          <Text style={styles.storyPos}>Top {shown.length}</Text>
        )}
      </View>
      <View style={styles.bigCard}>
        {shown.map((e, i) => {
          const cat = e.categoryId ? catById.get(e.categoryId) : undefined;
          const catName = cat?.name ?? 'Expense';
          const note = e.note && e.note !== catName ? e.note : null;
          const day = parseLocalIsoDate(e.date).toLocaleDateString(undefined, {
            weekday: 'short',
            day: 'numeric',
            month: 'short',
          });
          const sub = joinSub([day, note ? catName : inParent(parentNameOf(e.categoryId, catById))]);
          return (
            <Pressable
              key={e.id}
              onPress={() => onOpenDay(e.date)}
              style={withPressed([
                styles.dayRow,
                i === 0 && { borderTopWidth: 0 },
                openIso === e.date && styles.bigRowOn,
              ])}
              accessibilityRole="button"
              accessibilityLabel={`${note ?? catName}, ${day}. Show this day`}
            >
              <CategoryIcon name={cat?.icon ?? 'swap-horizontal'} color={cat?.color} />
              <View style={styles.dayMid}>
                <Text style={styles.dayName} numberOfLines={2}>
                  {note ?? catName}
                </Text>
                <Text style={styles.daySub} numberOfLines={1}>
                  {sub}
                </Text>
              </View>
              <Text style={styles.dayAmt}>
                −<Amount minor={e.amountMinor} sensitive={cat?.isSensitive} />
              </Text>
            </Pressable>
          );
        })}
        {share !== null && (
          <Text style={styles.bigFoot}>
            Together <Text style={styles.bigFootStrong}>{share}%</Text> of what you&rsquo;ve spent
            {scopeName ? ` on ${scopeName}` : ''}
            {inProgress ? ' so far' : ''}
          </Text>
        )}
      </View>
    </View>
  );
}
