import { useMemo } from 'react';
import { Pressable, View, StyleSheet } from 'react-native';
import ReanimatedAnimated from 'react-native-reanimated';
import Feather from '@expo/vector-icons/Feather';
import { Text } from '@/components/Text';
import { CategoryIcon } from '@/components/CategoryIcon';
import { MovingRow } from '@/components/MovingRow';
import { JustAddedGlow } from '@/components/JustAddedGlow';
import { Category, Transaction } from '@/types';
import { formatMoney } from '@/lib/money';
import { haptics } from '@/lib/haptics';
import { theme } from '@/constants/theme';
import { buildDayLane, LaneLine } from './transactions.helpers';
import { withPressed } from '@/lib/pressed';

function netMinorOf(items: Transaction[]): number {
  return items.reduce(
    (sum, tx) =>
      tx.type === 'income' ? sum + tx.amountMinor : tx.type === 'expense' ? sum - tx.amountMinor : sum,
    0
  );
}

function Amount({ type, minor }: { type: Transaction['type']; minor: number }) {
  return (
    <Text
      style={[styles.amount, type === 'income' && styles.income, type === 'expense' && styles.expense]}
      numberOfLines={1}
      adjustsFontSizeToFit
    >
      {type === 'income' ? '+' : type === 'expense' ? '−' : ''}
      {formatMoney(minor)}
    </Text>
  );
}

/**
 * One day on Activity (the Activity cleanup sign-off, option A): the day and
 * its net total, then one card with every entry of the day, each on a line
 * of the same two-line height — two or more of the same category stacked
 * into one line ("Food & Dining", "3 entries") that opens in place, and your
 * transfers between your own accounts as quiet rows at the end. No "+N
 * more": a busy day shows all of it.
 *
 * Which stacks are open is held by the screen (like the old "+N more"), since
 * this is a row in a virtualized list that unmounts as it scrolls away.
 */
export function TimelineDay({
  date,
  label,
  dateLabel,
  items,
  categories,
  accountName,
  categoryName,
  onPressTx,
  openStacks,
  onToggleStack,
  entering,
}: {
  date: string;
  label: string;
  dateLabel: string;
  items: Transaction[];
  categories: Category[];
  accountName: (id: string) => string;
  categoryName: (id: string | null) => string;
  onPressTx: (tx: Transaction) => void;
  openStacks: Set<string>;
  onToggleStack: (key: string) => void;
  entering?: React.ComponentProps<typeof ReanimatedAnimated.View>['entering'];
}) {
  const categoriesById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
  const { transfers, lines } = useMemo(() => buildDayLane(items, date), [items, date]);
  const net = netMinorOf(items);

  const renderLine = (line: LaneLine, i: number) => {
    if (line.kind === 'single') {
      const tx = line.tx;
      const cat = tx.categoryId ? categoriesById.get(tx.categoryId) : undefined;
      return (
        <MovingRow key={tx.id} style={i > 0 ? styles.divider : undefined}>
          <Pressable
            onPress={() => onPressTx(tx)}
            style={withPressed(styles.line)}
            accessibilityRole="button"
            accessibilityLabel={`${categoryName(tx.categoryId)}${tx.note ? `, ${tx.note}` : ''}, ${formatMoney(tx.amountMinor)}`}
          >
            <JustAddedGlow ids={[tx.id]} surface="activity" />
            <CategoryIcon name={cat?.icon ?? 'tag'} color={cat?.color} size={14} square={30} />
            <View style={styles.mid}>
              <Text style={styles.name} numberOfLines={1}>
                {categoryName(tx.categoryId)}
              </Text>
              <Text style={styles.sub} numberOfLines={1}>
                {tx.isRefund && <Text style={styles.refund}>Refund · </Text>}
                {tx.note ? `${tx.note} · ` : ''}
                {accountName(tx.accountId)}
              </Text>
            </View>
            <Amount type={tx.type} minor={tx.amountMinor} />
          </Pressable>
        </MovingRow>
      );
    }
    // A stack (one category, several entries) or a split (one payment, several
    // categories): one line that opens in place to show what's inside.
    const isSplit = line.kind === 'split';
    const cat = !isSplit && line.categoryId ? categoriesById.get(line.categoryId) : undefined;
    const open = openStacks.has(line.key);
    const first = line.items[0];
    const name = isSplit
      ? `Split · ${line.items.length} categories`
      : categoryName(line.kind === 'stack' ? line.categoryId : null);
    const type = isSplit ? 'expense' : line.type;
    // A stack from one account names it, like a single entry does; from several, just the count.
    const sameAccount = line.items.every((t) => t.accountId === first.accountId);
    return (
      <MovingRow key={line.key} style={i > 0 ? styles.divider : undefined}>
        <Pressable
          onPress={() => {
            haptics.tap();
            onToggleStack(line.key);
          }}
          style={withPressed(styles.line)}
          accessibilityRole="button"
          accessibilityState={{ expanded: open }}
          accessibilityLabel={`${name}, ${isSplit ? 'one payment' : `${line.items.length} entries`}, ${formatMoney(line.totalMinor)}. ${open ? 'Close' : 'Open'}`}
        >
          {/* A new entry folded into this line glows the line. */}
          <JustAddedGlow ids={line.items.map((t) => t.id)} surface="activity" />
          {isSplit ? (
            <CategoryIcon name="call-split" color={theme.colors.secondary} size={14} square={30} />
          ) : (
            <CategoryIcon name={cat?.icon ?? 'tag'} color={cat?.color} size={14} square={30} />
          )}
          <View style={styles.mid}>
            <View style={styles.stackMid}>
              <Text style={[styles.name, styles.stackName]} numberOfLines={1}>
                {name}
              </Text>
              <Feather name={open ? 'chevron-up' : 'chevron-down'} size={13} color={theme.colors.textMuted} />
            </View>
            <Text style={styles.sub} numberOfLines={1}>
              {isSplit
                ? `${first.note ? `${first.note} · ` : ''}${accountName(first.accountId)}`
                : `${line.items.length} entries${sameAccount ? ` · ${accountName(first.accountId)}` : ''}`}
            </Text>
          </View>
          <Amount type={type} minor={line.totalMinor} />
        </Pressable>
        {open && (
          <View style={styles.subList}>
            {line.items.map((tx) => {
              const label = isSplit ? categoryName(tx.categoryId) : tx.note || accountName(tx.accountId);
              return (
                <MovingRow key={tx.id}>
                  <Pressable
                    onPress={() => onPressTx(tx)}
                    style={withPressed(styles.subLine)}
                    accessibilityRole="button"
                    accessibilityLabel={`${isSplit ? label : name}${!isSplit && tx.note ? `, ${tx.note}` : ''}, ${formatMoney(tx.amountMinor)}`}
                  >
                    <Text style={styles.subName} numberOfLines={1}>
                      {label}
                    </Text>
                    <Amount type={tx.type} minor={tx.amountMinor} />
                  </Pressable>
                </MovingRow>
              );
            })}
          </View>
        )}
      </MovingRow>
    );
  };

  return (
    <ReanimatedAnimated.View entering={entering} style={styles.day}>
      <View style={styles.head}>
        <Text style={styles.title} numberOfLines={1}>
          {label}
          {'  '}
          <Text style={styles.date}>{dateLabel}</Text>
        </Text>
        {net !== 0 && (
          <Text style={[styles.total, net > 0 ? styles.income : styles.expense]}>
            {net > 0 ? '+' : '−'}
            {formatMoney(Math.abs(net))}
          </Text>
        )}
      </View>
      <View style={styles.lane}>
        {lines.map(renderLine)}
        {transfers.map((tx, i) => (
          <Pressable
            key={tx.id}
            onPress={() => onPressTx(tx)}
            style={withPressed([styles.line, (lines.length > 0 || i > 0) && styles.divider])}
            accessibilityRole="button"
            accessibilityLabel={`${formatMoney(tx.amountMinor)} moved from ${accountName(tx.accountId)} to ${accountName(tx.toAccountId!)}`}
          >
            <JustAddedGlow ids={[tx.id]} surface="activity" />
            <View style={styles.transferIcon}>
              <Feather name="repeat" size={13} color={theme.colors.ink} />
            </View>
            <View style={styles.mid}>
              <Text style={[styles.name, styles.transferName]} numberOfLines={1}>
                {accountName(tx.accountId)} → {accountName(tx.toAccountId!)}
              </Text>
              <Text style={styles.sub} numberOfLines={1}>
                {tx.note ? `${tx.note} · ` : ''}Moved between your accounts
              </Text>
            </View>
            <Text style={[styles.amount, styles.transferAmount]} numberOfLines={1}>
              {formatMoney(tx.amountMinor)}
            </Text>
          </Pressable>
        ))}
      </View>
    </ReanimatedAnimated.View>
  );
}

const styles = StyleSheet.create({
  day: { paddingHorizontal: 20, paddingBottom: 16 },
  head: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: 8,
    paddingHorizontal: 4,
    marginBottom: 8,
  },
  title: { flex: 1, fontFamily: theme.font.roundedBold, fontSize: 16, color: theme.colors.textPrimary },
  date: { fontFamily: theme.font.body, fontSize: 12, color: theme.colors.textMuted },
  total: { fontFamily: theme.font.monoBold, fontSize: 13 },
  transferIcon: {
    width: 30,
    height: 30,
    borderRadius: 30 * 0.32,
    backgroundColor: theme.colors.primaryTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  transferName: { fontFamily: theme.font.bodyMedium, color: theme.colors.textSecondary },
  transferAmount: { color: theme.colors.textSecondary },
  lane: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.xl2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.borderSoft,
    overflow: 'hidden',
  },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.colors.borderSoft },
  line: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
    // Every line has a name and a second line, so every line is this tall.
    minHeight: 52,
  },
  mid: { flex: 1, minWidth: 0 },
  stackMid: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  name: { fontFamily: theme.font.bodyBold, fontSize: 13, color: theme.colors.textPrimary },
  stackName: { flexShrink: 1 },
  sub: { fontFamily: theme.font.body, fontSize: 11, color: theme.colors.textMuted, marginTop: 1 },
  refund: { fontFamily: theme.font.bodyBold, color: theme.colors.income },
  amount: { fontFamily: theme.font.monoBold, fontSize: 12.5, color: theme.colors.textPrimary },
  income: { color: theme.colors.income },
  expense: { color: theme.colors.expense },
  subList: { backgroundColor: theme.colors.surfaceAlt },
  subLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    // Lines up with the stack's name: row padding + icon + gap.
    paddingLeft: 14 + 30 + 10,
    paddingRight: 14,
    paddingVertical: 8,
    minHeight: 36,
  },
  subName: { flex: 1, fontFamily: theme.font.body, fontSize: 12, color: theme.colors.textSecondary },
});
