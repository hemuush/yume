import { useMemo } from 'react';
import { Animated, Pressable, Text, View } from 'react-native';
import ReanimatedAnimated from 'react-native-reanimated';
import Feather from '@expo/vector-icons/Feather';
import { Category, Transaction } from '@/types';
import { TransactionRow } from './TransactionRow';
import { formatMoney } from '@/lib/money';
import { theme } from '@/constants/theme';
import { usePressScale } from '@/lib/usePressScale';
import { haptics } from '@/lib/haptics';
import { styles } from './transactions.styles';

const AnimatedMoreRow = Animated.createAnimatedComponent(Pressable);

// A day with more rows than this collapses the rest into a single "+N more"
// summary instead of growing the card — see the note on `dayCard` in
// transactions.styles.ts for why.
const ROW_CAP = 4;

function netMinorOf(items: Transaction[]): number {
  return items.reduce(
    (sum, tx) =>
      tx.type === 'income' ? sum + tx.amountMinor : tx.type === 'expense' ? sum - tx.amountMinor : sum,
    0
  );
}

/** `+₹1,234` / `-₹1,234` / `''` for a dead-even day — shared by the card's own total and its "+N more" row. */
function signedAmount(netMinor: number): { text: string; style: object | undefined } {
  if (netMinor === 0) return { text: formatMoney(0), style: undefined };
  const sign = netMinor > 0 ? '+' : '-';
  return {
    text: `${sign}${formatMoney(Math.abs(netMinor))}`,
    style: netMinor > 0 ? styles.income : styles.expense,
  };
}

/**
 * One day's transactions, boxed — the day itself is the unit worth a
 * glance-and-move-on read, not each transaction inside it. Rows past
 * `ROW_CAP` start collapsed behind a "+N more" row so a ten-transaction day
 * never dwarfs its neighbours; tapping it expands this one card in place.
 *
 * `expanded`/`onExpand` are controlled by the parent (keyed by day, in
 * app/(tabs)/transactions.tsx) rather than local state here: this card is
 * rendered as a row inside a virtualized `FlatList`, which unmounts and
 * later remounts rows as they scroll off- and back on-screen — local state
 * would silently reset to collapsed on remount, undoing a user's explicit
 * "+N more" tap the moment they scrolled away and back.
 */
export function DayCard({
  label,
  dateLabel,
  items,
  categories,
  accountName,
  categoryName,
  onPressTx,
  expanded,
  onExpand,
  entering,
}: {
  label: string;
  dateLabel: string;
  items: Transaction[];
  categories: Category[];
  accountName: (id: string) => string;
  categoryName: (id: string | null) => string;
  onPressTx: (tx: Transaction) => void;
  expanded: boolean;
  onExpand: () => void;
  entering?: any;
}) {
  const shown = expanded ? items : items.slice(0, ROW_CAP);
  // Nothing reads `hidden` once expanded (the "+N more" row below is gone
  // by then) — skip the slice for a case every render of an already-
  // expanded day would otherwise pay for nothing.
  const hidden = expanded ? [] : items.slice(ROW_CAP);
  const expand = () => {
    haptics.tap();
    onExpand();
  };
  const { animatedStyle, onPressIn, onPressOut } = usePressScale(0.98);

  const total = signedAmount(netMinorOf(items));
  const hiddenTotal = signedAmount(netMinorOf(hidden));
  // Built once per `categories` change rather than `.find()`-ing through the
  // full list for every transaction row on every render.
  const categoriesById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);

  return (
    <ReanimatedAnimated.View style={styles.dayCard} entering={entering}>
      <View style={styles.dayCardHead}>
        <Text style={styles.dayLabel}>
          {label}
          {'  '}
          <Text style={styles.dayLabelDate}>{dateLabel}</Text>
        </Text>
        <Text style={[styles.dayCardTotal, total.style]}>{total.text}</Text>
      </View>
      {shown.map((tx, i) => {
        const cat = tx.categoryId ? categoriesById.get(tx.categoryId) : undefined;
        return (
          <TransactionRow
            key={tx.id}
            tx={tx}
            cat={cat}
            accountName={accountName}
            categoryName={categoryName}
            divider={i > 0}
            onPress={() => onPressTx(tx)}
          />
        );
      })}
      {!expanded && hidden.length > 0 && (
        <AnimatedMoreRow
          style={[styles.dayMoreRow, animatedStyle]}
          onPress={expand}
          onPressIn={onPressIn}
          onPressOut={onPressOut}
        >
          <View style={styles.dayMoreDots}>
            <Feather name="more-horizontal" size={16} color={theme.colors.textMuted} />
          </View>
          <Text style={styles.dayMoreText}>+{hidden.length} more</Text>
          <Text style={styles.dayMoreAmt}>{hiddenTotal.text}</Text>
        </AnimatedMoreRow>
      )}
    </ReanimatedAnimated.View>
  );
}
