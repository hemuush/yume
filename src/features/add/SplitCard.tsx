import { View, Pressable, StyleSheet } from 'react-native';
import { Text } from '@/components/Text';
import { theme } from '@/constants/theme';
import { EYEBROW } from '@/constants/textStyles';
import { formatMoney } from '@/lib/money';
import { withPressed } from '@/lib/pressed';
import { categorySentence, parentNameOf } from '@/lib/categoryLabel';
import { Category } from '@/types';
import { DraftPart, partAmounts, splitProblem, splitProblemText } from './splitDraft';

/**
 * How a payment divides, as one bar: a segment per part, as wide as its share, in its category's colour.
 * Shared by the split page and Add's split card.
 */
export function SplitMeter({
  parts,
  amounts,
  categories,
}: {
  parts: DraftPart[];
  amounts: number[];
  categories: Category[];
}) {
  return (
    <View style={styles.meter} accessible={false}>
      {parts.map((p, i) =>
        amounts[i] > 0 ? (
          <View
            key={p.key}
            style={{
              flex: amounts[i],
              backgroundColor:
                categories.find((c) => c.id === p.categoryId)?.color ?? theme.colors.inkHairline,
            }}
          />
        ) : null
      )}
    </View>
  );
}

/**
 * Add's stand-in for the category grid while an entry is split: the parts, Edit split (opens the split
 * page), and for a new entry a way to stop splitting.
 */
export function SplitCard({
  parts,
  totalMinor,
  categories,
  currency,
  onEdit,
  onRemove,
}: {
  parts: DraftPart[];
  totalMinor: number;
  categories: Category[];
  currency: string | undefined;
  onEdit: () => void;
  /** Absent while editing a saved split, which stays a split. */
  onRemove?: () => void;
}) {
  const amounts = partAmounts(totalMinor, parts);
  const categoriesById = new Map(categories.map((c) => [c.id, c]));
  const labelOf = (categoryId: string | null | undefined) => {
    const cat = categoryId ? categoriesById.get(categoryId) : undefined;
    return cat ? categorySentence(cat.name, parentNameOf(categoryId, categoriesById)) : undefined;
  };
  const nameOf = (key: string) => labelOf(parts.find((p) => p.key === key)?.categoryId) ?? 'this part';
  const problem = splitProblem(totalMinor, parts);
  return (
    <View style={styles.wrap}>
      <View style={styles.card}>
        <View style={styles.head}>
          <Text style={styles.eyebrow}>Split {parts.length} ways</Text>
          <Pressable
            onPress={onEdit}
            hitSlop={8}
            style={withPressed(styles.edit)}
            accessibilityRole="button"
            accessibilityLabel="Edit split"
          >
            <Text style={styles.editText}>Edit split</Text>
          </Pressable>
        </View>
        <SplitMeter parts={parts} amounts={amounts} categories={categories} />
        <View style={styles.lines}>
          {parts.map((p, i) => {
            const cat = categories.find((c) => c.id === p.categoryId);
            return (
              <View key={p.key} style={styles.line}>
                <View style={[styles.dot, { backgroundColor: cat?.color ?? theme.colors.inkHairline }]} />
                <Text style={styles.name} numberOfLines={1}>
                  {labelOf(p.categoryId) ?? 'No category yet'}
                </Text>
                <Text style={styles.amount}>{formatMoney(Math.max(0, amounts[i]), currency)}</Text>
              </View>
            );
          })}
        </View>
        {problem && (
          // The payment was changed on Add to less than the other parts: say what's off.
          <Text style={styles.problem}>
            {splitProblemText(problem, parts, nameOf, (m) => formatMoney(m, currency))}. Tap Edit split.
          </Text>
        )}
      </View>
      {onRemove && (
        <Pressable
          onPress={onRemove}
          hitSlop={8}
          style={withPressed(styles.remove)}
          accessibilityRole="button"
        >
          <Text style={styles.removeText}>Don&rsquo;t split</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  meter: {
    flexDirection: 'row',
    gap: 2,
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
    backgroundColor: theme.colors.surfaceAlt,
  },
  wrap: { marginBottom: 18 },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.xl2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.borderSoft,
    padding: 16,
    gap: 12,
  },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  eyebrow: EYEBROW,
  edit: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: theme.radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.borderSoft,
    backgroundColor: theme.colors.surface,
  },
  editText: { fontFamily: theme.font.roundedMedium, fontSize: 12.5, color: theme.colors.textPrimary },
  lines: { gap: 8 },
  line: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dot: { width: 10, height: 10, borderRadius: 3 },
  name: { flex: 1, fontFamily: theme.font.bodyMedium, fontSize: 13.5, color: theme.colors.textPrimary },
  amount: { fontFamily: theme.font.monoBold, fontSize: 13, color: theme.colors.textPrimary },
  problem: { fontFamily: theme.font.bodyBold, fontSize: 12, color: theme.colors.expenseText },
  remove: { alignSelf: 'center', marginTop: 12, paddingVertical: 4 },
  removeText: { fontFamily: theme.font.bodyBold, fontSize: 13, color: theme.colors.textMuted },
});
