import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Pressable, View, StyleSheet } from 'react-native';
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
import { buildDayLane, dropIndex, laneOrderIds, LaneLine, moveLine } from './transactions.helpers';
import { DraggableLine } from './DraggableLine';
import { withPressed } from '@/lib/pressed';

const laneKey = (line: LaneLine) => (line.kind === 'single' ? line.tx.id : line.key);

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
  onReorder,
  onDragActive,
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
  /** Saves the day's new order (entry ids, top to bottom). Omit to turn hand-ordering off (search, filters). */
  onReorder?: (date: string, orderedIds: string[]) => Promise<void>;
  /** True while a line is held and dragged, so the list can stop scrolling under the finger. */
  onDragActive?: (active: boolean) => void;
}) {
  const categoriesById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
  const { transfers, lines } = useMemo(() => buildDayLane(items, date), [items, date]);
  const net = netMinorOf(items);

  // Hand-ordering: hold a line to lift it, drag it, let go. `arranged` shows the
  // new order straight away, until the reloaded entries carry it themselves.
  const [arranged, setArranged] = useState<LaneLine[] | null>(null);
  const [drag, setDrag] = useState<{ from: number; to: number; height: number } | null>(null);
  const [settling, setSettling] = useState(false);
  const dragRef = useRef<{ from: number; to: number; height: number } | null>(null);
  const heights = useRef(new Map<string, number>());
  const [dy] = useState(() => new Animated.Value(0));
  useEffect(() => setArranged(null), [items]);
  const shown = arranged ?? lines;
  const canReorder = !!onReorder && shown.length > 1;

  const heightsInOrder = () => shown.map((l) => heights.current.get(laneKey(l)) ?? 52);
  const lift = (index: number) => {
    haptics.tap();
    dy.setValue(0);
    dragRef.current = { from: index, to: index, height: heights.current.get(laneKey(shown[index])) ?? 52 };
    setDrag(dragRef.current);
    onDragActive?.(true);
  };
  const moveTo = (offset: number) => {
    const cur = dragRef.current;
    if (!cur) return;
    const to = dropIndex(heightsInOrder(), cur.from, offset);
    if (to === cur.to) return;
    haptics.tap();
    dragRef.current = { ...cur, to };
    setDrag(dragRef.current);
  };
  const reorder = useCallback(
    async (next: LaneLine[]) => {
      setSettling(true);
      setArranged(next);
      setTimeout(() => setSettling(false), 150);
      try {
        await onReorder?.(date, laneOrderIds(next, transfers));
      } catch {
        haptics.warn();
        setArranged(null);
      }
    },
    [onReorder, date, transfers]
  );
  const drop = () => {
    const cur = dragRef.current;
    if (!cur) return;
    dragRef.current = null;
    setDrag(null);
    dy.setValue(0);
    onDragActive?.(false);
    if (cur.to !== cur.from) void reorder(moveLine(shown, cur.from, cur.to));
  };
  // Move up / move down, for TalkBack and switch access, where dragging isn't possible.
  const a11yMove = (index: number, by: -1 | 1) => {
    const to = index + by;
    if (to < 0 || to >= shown.length) return;
    haptics.tap();
    void reorder(moveLine(shown, index, to));
  };
  const reorderProps = (index: number) =>
    canReorder
      ? {
          onLongPress: () => lift(index),
          delayLongPress: 350,
          accessibilityActions: [
            { name: 'moveUp', label: 'Move up' },
            { name: 'moveDown', label: 'Move down' },
          ],
          onAccessibilityAction: (e: { nativeEvent: { actionName: string } }) =>
            a11yMove(index, e.nativeEvent.actionName === 'moveUp' ? -1 : 1),
        }
      : {};
  // How far line `i` makes room for the lifted one.
  const shiftOf = (i: number) => {
    if (!drag || i === drag.from) return 0;
    if (drag.from < drag.to && i > drag.from && i <= drag.to) return -drag.height;
    if (drag.from > drag.to && i >= drag.to && i < drag.from) return drag.height;
    return 0;
  };

  const renderLine = (line: LaneLine, i: number) => {
    if (line.kind === 'single') {
      const tx = line.tx;
      const cat = tx.categoryId ? categoriesById.get(tx.categoryId) : undefined;
      return (
        <MovingRow key={tx.id} moving={!settling} style={i > 0 ? styles.divider : undefined}>
          <Pressable
            onPress={() => onPressTx(tx)}
            {...reorderProps(i)}
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
      <MovingRow key={line.key} moving={!settling} style={i > 0 ? styles.divider : undefined}>
        <Pressable
          onPress={() => {
            haptics.tap();
            onToggleStack(line.key);
          }}
          {...reorderProps(i)}
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
          <View>
            {line.items.map((tx) => {
              // A split's part is its category, with its account under it. A stack's
              // entry (they all share the category already named above) is its note
              // over its account — or just the account, when there's no note.
              const partCat = isSplit ? categoriesById.get(tx.categoryId ?? '') : cat;
              const label = isSplit ? categoryName(tx.categoryId) : tx.note || accountName(tx.accountId);
              const sub = isSplit
                ? `${tx.note ? `${tx.note} · ` : ''}${accountName(tx.accountId)}`
                : tx.note
                  ? accountName(tx.accountId)
                  : null;
              return (
                <MovingRow key={tx.id} style={styles.divider}>
                  <Pressable
                    onPress={() => onPressTx(tx)}
                    style={withPressed(styles.subLine)}
                    accessibilityRole="button"
                    accessibilityLabel={`${isSplit ? label : name}${!isSplit && tx.note ? `, ${tx.note}` : ''}, ${formatMoney(tx.amountMinor)}`}
                  >
                    <View
                      style={[styles.subDot, { backgroundColor: partCat?.color ?? theme.colors.borderSoft }]}
                    />
                    <View style={styles.mid}>
                      <Text style={styles.name} numberOfLines={1}>
                        {label}
                      </Text>
                      {sub && (
                        <Text style={styles.sub} numberOfLines={1}>
                          {sub}
                        </Text>
                      )}
                    </View>
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
        {shown.map((line, i) => (
          <DraggableLine
            key={laneKey(line)}
            lifted={drag?.from === i}
            shift={shiftOf(i)}
            dy={dy}
            onHeight={(h) => heights.current.set(laneKey(line), h)}
            onMove={moveTo}
            onEnd={drop}
          >
            {renderLine(line, i)}
          </DraggableLine>
        ))}
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
  refund: { fontFamily: theme.font.bodyBold, color: theme.colors.incomeText },
  amount: { fontFamily: theme.font.monoBold, fontSize: 12.5, color: theme.colors.textPrimary },
  income: { color: theme.colors.incomeText },
  expense: { color: theme.colors.expenseText },
  // An open stack's entries: the same card, hairlines and text as every other
  // line, each with a dot in its category's colour under the stack's icon.
  subLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    // The dot centred under the stack's 30px icon: row padding + (30 − 8) / 2.
    paddingLeft: 14 + 11,
    paddingRight: 14,
    paddingVertical: 8,
    minHeight: 48,
  },
  subDot: { width: 8, height: 8, borderRadius: 4, marginRight: 11 },
});
