import { View, Pressable, ActivityIndicator } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { inParent, joinSub, parentNameOf } from '@/lib/categoryLabel';
import { Text } from '@/components/Text';
import { Amount } from '@/components/Amount';
import { CategoryIcon } from '@/components/CategoryIcon';
import { SuuIllustration } from '@/components/SuuIllustration';
import { Category, Transaction } from '@/types';
import { parseLocalIsoDate } from '@/lib/date';
import { theme } from '@/constants/theme';
import { withPressed } from '@/lib/pressed';
import { DayTotal } from './DayTotal';
import { styles } from './reports.styles';

const txCount = (txs: Transaction[] | null) =>
  txs && txs.length > 0 ? `${txs.length} transaction${txs.length === 1 ? '' : 's'}` : undefined;

/**
 * One heatmap day's entries, open under the grid. `txs` is null while loading.
 * With a category filter on, the heatmap showed only that category's days, so
 * the list does too (the caller filters).
 */
export function DayCard({
  iso,
  txs,
  catById,
  onClose,
}: {
  iso: string;
  txs: Transaction[] | null;
  catById: Map<string, Category>;
  onClose: () => void;
}) {
  const title = parseLocalIsoDate(iso).toLocaleDateString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'long',
  });
  const count = txCount(txs);
  return (
    <View style={styles.dayCard}>
      <View style={styles.dayHead}>
        <View style={styles.dayHeadText}>
          <Text style={styles.dayTitle}>{title}</Text>
          {count ? <Text style={styles.daySub}>{count}</Text> : null}
        </View>
        <Pressable
          onPress={onClose}
          hitSlop={10}
          style={withPressed(styles.dayClose)}
          accessibilityRole="button"
          accessibilityLabel="Close this day"
        >
          <Feather name="x" size={16} color={theme.colors.textSecondary} />
        </Pressable>
      </View>

      {txs === null ? (
        <ActivityIndicator color={theme.colors.ink} style={styles.daySpinner} />
      ) : txs.length === 0 ? (
        <View style={styles.dayEmpty}>
          <SuuIllustration size={72} pose="sleepy" />
          <Text style={styles.empty}>Nothing on this day.</Text>
        </View>
      ) : (
        txs.map((tx) => {
          const cat = tx.categoryId ? catById.get(tx.categoryId) : undefined;
          const primary =
            cat?.name ?? (tx.type === 'transfer' ? 'Transfer' : tx.type === 'income' ? 'Income' : 'Expense');
          const note = tx.note && tx.note !== primary ? tx.note : null;
          const sub = joinSub([inParent(parentNameOf(tx.categoryId, catById)), note]);
          const sign = tx.type === 'expense' ? '−' : tx.type === 'income' ? '+' : '';
          return (
            <View key={tx.id} style={styles.dayRow}>
              <CategoryIcon name={cat?.icon ?? 'swap-horizontal'} color={cat?.color} />
              <View style={styles.dayMid}>
                <Text style={styles.dayName} numberOfLines={1}>
                  {primary}
                </Text>
                {sub ? (
                  <Text style={styles.daySub} numberOfLines={1}>
                    {sub}
                  </Text>
                ) : null}
              </View>
              <Text
                style={[
                  styles.dayAmt,
                  tx.type === 'income' && { color: theme.colors.incomeText },
                  tx.type === 'expense' && { color: theme.colors.expenseText },
                  tx.type === 'transfer' && { color: theme.colors.textSecondary },
                ]}
              >
                {sign}
                <Amount minor={tx.amountMinor} sensitive={cat?.isSensitive} />
              </Text>
            </View>
          );
        })
      )}

      {txs && txs.length > 0 && (
        <View style={styles.dayFoot}>
          <DayTotal txs={txs} />
        </View>
      )}
    </View>
  );
}
