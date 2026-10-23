import { Animated, Pressable, View } from 'react-native';
import { Text } from '@/components/Text';
import Feather from '@expo/vector-icons/Feather';
import { theme } from '@/constants/theme';
import { formatMoney } from '@/lib/money';
import { CategoryIcon } from '@/components/CategoryIcon';
import { MovingRow } from '@/components/MovingRow';
import { styles } from '@/features/add/add.styles';
import { Staged, dateChipLabel } from '@/features/add/addEntry';
import { withPressedTint } from '@/lib/pressed';
import { inParent } from '@/lib/categoryLabel';
import { useAccent } from '@/theme/AccentContext';

/** Entries added with "Add to list", waiting for Save, each removable. */
export function StagedList({
  rows,
  netMinor,
  fadeStyle,
  onRemove,
}: {
  rows: Staged[];
  /** Income less spending across the list. */
  netMinor: number;
  fadeStyle: React.ComponentProps<typeof Animated.View>['style'];
  onRemove: (id: string) => void;
}) {
  const { accent, secondary } = useAccent();
  return (
    <Animated.View style={[styles.staged, fadeStyle]}>
      <View style={styles.stagedHeadRow}>
        <Text style={styles.stagedHead}>{rows.length} staged</Text>
        <Text style={styles.stagedHeadTotal}>
          {netMinor >= 0 ? '+' : '−'}
          {formatMoney(Math.abs(netMinor))}
        </Text>
      </View>
      {rows.map((r, i) => {
        const incomeLike = r.kind === 'transaction' ? r.type === 'income' : r.sign === -1;
        const expenseLike = r.kind === 'transaction' ? r.type === 'expense' : r.sign === 1;
        return (
          <MovingRow key={r.id} style={[styles.stagedRow, i > 0 && styles.stagedRowDivider]}>
            <CategoryIcon
              name={r.kind === 'transaction' ? r.categoryIcon : 'account-multiple'}
              color={r.kind === 'friend' || r.type === 'transfer' ? secondary : r.categoryColor}
              size={15}
              square={30}
            />
            <View style={styles.stagedMid}>
              <Text style={styles.stagedLabel} numberOfLines={1}>
                {r.kind === 'transaction'
                  ? r.label
                  : `${r.personName} ${r.sign === 1 ? 'owes more' : 'repaid'}`}
                {!!r.note && <Text style={styles.stagedNote}> · {r.note}</Text>}
              </Text>
              <Text style={styles.stagedSub}>
                {r.kind === 'transaction' && r.parentName ? `${inParent(r.parentName)} · ` : ''}
                {dateChipLabel(r.date)}
                {r.kind === 'friend' ? ` · ${r.accountName ?? 'balance only'}` : ''}
              </Text>
            </View>
            <Text style={[styles.stagedValue, incomeLike && styles.income, expenseLike && styles.expense]}>
              {incomeLike ? '+' : expenseLike ? '−' : ''}
              {formatMoney(r.amountMinor)}
            </Text>
            <Pressable
              onPress={() => onRemove(r.id)}
              hitSlop={4}
              style={withPressedTint(accent, styles.removeBtn)}
              accessibilityRole="button"
              accessibilityLabel="Remove this entry from the list"
            >
              <Feather name="x" size={14} color={theme.colors.textMuted} />
            </Pressable>
          </MovingRow>
        );
      })}
    </Animated.View>
  );
}
