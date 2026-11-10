import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Pressable, View, StyleSheet, useWindowDimensions } from 'react-native';
import ReanimatedAnimated from 'react-native-reanimated';
import Feather from '@expo/vector-icons/Feather';
import { Text } from '@/components/Text';
import { CategoryIcon } from '@/components/CategoryIcon';
import { SECTION_TITLE } from '@/constants/textStyles';
import { StatusBadge } from '@/components/StatusBadge';
import { MovingRow } from '@/components/MovingRow';
import { JustAddedGlow } from '@/components/JustAddedGlow';
import { Category, Transaction } from '@/types';
import { dayMonth } from '@/lib/dateLabels';
import { formatMaskableMoney, formatMoney } from '@/lib/money';
import { getCachedCurrency } from '@/db/settings';
import { usePrivacy } from '@/theme/PrivacyContext';
import { useAccent } from '@/theme/AccentContext';
import { softTint } from '@/components/softTint';
import { haptics } from '@/lib/haptics';
import { theme } from '@/constants/theme';
import {
  buildDayLane,
  dropIndex,
  laneOrderIds,
  LaneLine,
  moveLine,
  type ValueNote,
} from './transactions.helpers';
import { investLines, investRole } from '@/lib/investment';
import { isSavingsEntry } from '@/lib/privateSummary';
import { DraggableLine } from './DraggableLine';
import { withPressedTint } from '@/lib/pressed';
import { categorySpoken, joinSub, parentNameOf } from '@/lib/categoryLabel';
import { compactMoney } from '@/lib/compactMoney';
import { shade } from '@/lib/color';
import { parseLocalIsoDate } from '@/lib/date';

/** A compact row: its least height and the category disc it leads with. */
const ROW_H = 48;
const ICON = 32;
/** The date column's width beside a day's entries. */
const DATE_W = 36;
/** The rail: its dot sits level with the first entry's centre, and its line runs through the gap to the next day. */
const DOT = 12;
const DOT_TOP = 19;

const NO_ACCOUNTS: ReadonlySet<string> = new Set();
const NO_NOTES: ValueNote[] = [];

const laneKey = (line: LaneLine) => (line.kind === 'single' ? line.tx.id : line.key);

function netMinorOf(items: Transaction[]): number {
  return items.reduce(
    (sum, tx) =>
      tx.type === 'income' ? sum + tx.amountMinor : tx.type === 'expense' ? sum - tx.amountMinor : sum,
    0
  );
}

function Amount({
  type,
  minor,
  masked,
  currency,
}: {
  type: Transaction['type'];
  minor: number;
  masked: boolean;
  currency: string;
}) {
  return (
    <Text style={[styles.amount, type === 'income' && styles.income]} numberOfLines={1} adjustsFontSizeToFit>
      {type === 'income' ? '+' : type === 'expense' ? '−' : ''}
      {formatMaskableMoney(minor, { masked, currency })}
    </Text>
  );
}

/**
 * One Activity day: day + net total (omitted if one line), a card of every entry, transfers as quiet end
 * rows. 2+ same-category entries stack into an openable line; the screen holds open stacks (rows unmount).
 */
function TimelineDayView({
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
  savingsAccountIds = NO_ACCOUNTS,
  investmentIds = NO_ACCOUNTS,
  notes = NO_NOTES,
  onPressNote,
  accountCurrency = () => getCachedCurrency(),
  timeline = false,
  isToday = false,
  selected = false,
  position = 'only',
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
  /**
   * Accounts of type savings — transfers into or out of them are hidden with "hide savings & investment
   * amounts".
   */
  savingsAccountIds?: ReadonlySet<string>;
  /** Accounts that are investments: a transfer into or out of one reads as Invested or Withdrawn. */
  investmentIds?: ReadonlySet<string>;
  /** Value updates dated this day, listed under the Invest chip. */
  notes?: ValueNote[];
  /** Tapping a value update (opens the investments page). */
  onPressNote?: (note: ValueNote) => void;
  accountCurrency?: (id: string) => string;
  /** Activity's list: the date sits beside the day's entries, on a rail with a dot per day. */
  timeline?: boolean;
  /** Fills the day's dot in the theme colour and says TODAY. */
  isToday?: boolean;
  /** The day picked on the chart: its dot takes an ink edge. */
  selected?: boolean;
  /** Where the day sits in the list, so the rail starts and ends at a dot instead of dangling. */
  position?: 'only' | 'first' | 'middle' | 'last';
}) {
  const { hideAmounts } = usePrivacy();
  const { width, fontScale } = useWindowDimensions();
  const stacked = width < 360 || fontScale > 1.2;
  const { accent, secondary } = useAccent();
  const categoriesById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
  // Parent context for a subcategory; top-level categories need no extra label.
  const parentLine = (categoryId: string | null) => parentNameOf(categoryId, categoriesById);
  const { transfers, lines } = useMemo(
    () => buildDayLane(items, date, accountCurrency),
    [items, date, accountCurrency]
  );
  const hidden = (tx: Transaction) => hideAmounts && isSavingsEntry(tx, categoriesById, savingsAccountIds);
  const money = (minor: number, masked: boolean, accountId: string) =>
    formatMaskableMoney(minor, { masked, currency: accountCurrency(accountId) });
  // With savings hidden the day's total leaves those entries out, or a day with one of them would give it
  // away.
  const net = netMinorOf(
    items.filter(
      (tx) => accountCurrency(tx.accountId) === getCachedCurrency() && (!hideAmounts || !hidden(tx))
    )
  );

  // Hand-ordering: hold a line to lift it, drag it, let go. `arranged` shows the
  // new order straight away, until the reloaded entries carry it themselves.
  // It remembers the entries it was arranged from: once they reload it no longer applies, with no
  // reset effect (and its extra render) needed.
  const [arrangedState, setArrangedState] = useState<{ from: Transaction[]; lines: LaneLine[] } | null>(null);
  const arranged = arrangedState && arrangedState.from === items ? arrangedState.lines : null;
  const setArranged = useCallback(
    (lines: LaneLine[] | null) => setArrangedState(lines ? { from: items, lines } : null),
    [items]
  );
  const [dragState, setDrag] = useState<{
    from: number;
    to: number;
    height: number;
    items: Transaction[];
  } | null>(null);
  const drag = dragState?.items === items && onReorder ? dragState : null;
  const [settlingItems, setSettlingItems] = useState<Transaction[] | null>(null);
  const settling = settlingItems === items;
  const reorderSeq = useRef({ value: 0 });
  const dragRef = useRef<{ from: number; to: number; height: number } | null>(null);
  const heights = useRef(new Map<string, number>());
  const [dy] = useState(() => new Animated.Value(0));
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    const generation = reorderSeq.current;
    // Reloading/filtering a held day must release the screen's scroll lock as well.
    return () => {
      generation.value++;
      if (settleTimer.current) clearTimeout(settleTimer.current);
      if (dragRef.current) onDragActive?.(false);
      dragRef.current = null;
      dy.stopAnimation();
    };
  }, [items, onReorder, onDragActive, dy]);
  const shown = arranged ?? lines;
  const canReorder = !!onReorder && shown.length > 1;

  const heightsInOrder = () => shown.map((l) => heights.current.get(laneKey(l)) ?? ROW_H);
  const lift = (index: number) => {
    haptics.tap();
    dy.setValue(0);
    dragRef.current = { from: index, to: index, height: heights.current.get(laneKey(shown[index])) ?? ROW_H };
    setDrag({ ...dragRef.current, items });
    onDragActive?.(true);
  };
  const moveTo = (offset: number) => {
    const cur = dragRef.current;
    if (!cur) return;
    const to = dropIndex(heightsInOrder(), cur.from, offset);
    if (to === cur.to) return;
    haptics.tap();
    dragRef.current = { ...cur, to };
    setDrag({ ...dragRef.current, items });
  };
  const reorder = useCallback(
    async (next: LaneLine[]) => {
      const seq = ++reorderSeq.current.value;
      setSettlingItems(items);
      setArranged(next);
      if (settleTimer.current) clearTimeout(settleTimer.current);
      settleTimer.current = setTimeout(() => {
        if (seq === reorderSeq.current.value) setSettlingItems(null);
      }, 150);
      try {
        await onReorder?.(date, laneOrderIds(next, transfers));
      } catch {
        if (seq !== reorderSeq.current.value) return;
        haptics.warn();
        setArranged(null);
      }
    },
    [onReorder, date, transfers, setArranged, items]
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
        <MovingRow key={tx.id} moving={!settling}>
          {i > 0 && <View style={styles.separator} />}
          <Pressable
            onPress={() => onPressTx(tx)}
            {...reorderProps(i)}
            style={withPressedTint(accent, [styles.line, stacked && styles.wrapLine])}
            accessibilityRole="button"
            accessibilityLabel={`${categorySpoken(categoryName(tx.categoryId), parentNameOf(tx.categoryId, categoriesById))}${tx.isRefund ? ', refund' : ''}${tx.note ? `, ${tx.note}` : ''}, ${money(tx.amountMinor, hidden(tx), tx.accountId)}`}
          >
            <JustAddedGlow ids={[tx.id]} surface="activity" />
            <View style={styles.lead}>
              <CategoryIcon name={cat?.icon ?? 'tag'} color={cat?.color} size={15} square={ICON} round />
            </View>
            <View style={[styles.mid, stacked && styles.wideMid]}>
              <View style={styles.entryHead}>
                <Text style={[styles.name, styles.stackName]}>{tx.note || categoryName(tx.categoryId)}</Text>
                {tx.isRefund && <StatusBadge label="Refund" tone="complete" />}
                {tx.splitId && <StatusBadge label="Split" />}
              </View>
              <Text style={styles.sub}>
                {joinSub([
                  tx.note && categoryName(tx.categoryId),
                  parentLine(tx.categoryId),
                  accountName(tx.accountId),
                ])}
              </Text>
            </View>
            <Amount
              type={tx.type}
              minor={tx.amountMinor}
              masked={hidden(tx)}
              currency={accountCurrency(tx.accountId)}
            />
          </Pressable>
        </MovingRow>
      );
    }
    // A stack (one category, several entries): one line that opens in place to show what's inside.
    const cat = line.categoryId ? categoriesById.get(line.categoryId) : undefined;
    const open = openStacks.has(line.key);
    const first = line.items[0];
    const name = categoryName(line.categoryId);
    const stackParent = parentNameOf(line.categoryId, categoriesById);
    const lineMasked = line.items.some(hidden);
    // A stack from one account names it, like a single entry does; from several, just the count.
    const sameAccount = line.items.every((t) => t.accountId === first.accountId);
    return (
      <MovingRow key={line.key} moving={!settling}>
        {i > 0 && <View style={styles.separator} />}
        <Pressable
          onPress={() => {
            haptics.tap();
            onToggleStack(line.key);
          }}
          {...reorderProps(i)}
          style={withPressedTint(accent, [styles.line, stacked && styles.wrapLine])}
          accessibilityRole="button"
          accessibilityState={{ expanded: open }}
          accessibilityLabel={`${categorySpoken(name, stackParent)}${line.items.every((t) => t.isRefund) ? ', refunds' : ''}, ${line.items.length} entries, ${money(line.totalMinor, lineMasked, first.accountId)}. ${open ? 'Close' : 'Open'}`}
        >
          {/* A new entry folded into this line glows the line. */}
          <JustAddedGlow ids={line.items.map((t) => t.id)} surface="activity" />
          <View style={styles.lead}>
            <CategoryIcon name={cat?.icon ?? 'tag'} color={cat?.color} size={15} square={ICON} round />
          </View>
          <View style={[styles.mid, stacked && styles.wideMid]}>
            <View style={styles.stackMid}>
              <Text style={[styles.name, styles.stackName]}>{name}</Text>
              {line.items.every((t) => t.isRefund) && <StatusBadge label="Refund" tone="complete" />}
              <View style={styles.stackChip}>
                <Text style={styles.stackCount}>{line.items.length}</Text>
                <Feather
                  name={open ? 'chevron-up' : 'chevron-down'}
                  size={13}
                  color={theme.colors.textSecondary}
                />
              </View>
            </View>
            <Text style={styles.sub}>
              {joinSub([
                stackParent,
                `${line.items.length} entries`,
                sameAccount && accountName(first.accountId),
              ])}
            </Text>
          </View>
          <Amount
            type={line.type}
            minor={line.totalMinor}
            masked={lineMasked}
            currency={accountCurrency(first.accountId)}
          />
        </Pressable>
        {open && (
          <View>
            {line.items.map((tx) => {
              // The category is already named above: note over account, or just the account with no note.
              const label = tx.note || accountName(tx.accountId);
              const sub = tx.note ? accountName(tx.accountId) : null;
              return (
                <MovingRow key={tx.id}>
                  <View style={styles.separator} />
                  <Pressable
                    onPress={() => onPressTx(tx)}
                    style={withPressedTint(accent, [styles.subLine, stacked && styles.wrapLine])}
                    accessibilityRole="button"
                    accessibilityLabel={`${categorySpoken(name, stackParent)}${tx.isRefund ? ', refund' : ''}${tx.note ? `, ${tx.note}` : ''}, ${money(tx.amountMinor, hidden(tx), tx.accountId)}`}
                  >
                    <View
                      style={[styles.subDot, { backgroundColor: cat?.color ?? theme.colors.borderSoft }]}
                    />
                    <View style={[styles.mid, stacked && styles.wideMid]}>
                      <View style={styles.entryHead}>
                        <Text style={[styles.name, styles.stackName]}>{label}</Text>
                        {tx.splitId && <StatusBadge label="Split" />}
                      </View>
                      {sub && <Text style={styles.sub}>{sub}</Text>}
                    </View>
                    <Amount
                      type={tx.type}
                      minor={tx.amountMinor}
                      masked={hidden(tx)}
                      currency={accountCurrency(tx.accountId)}
                    />
                  </Pressable>
                </MovingRow>
              );
            })}
          </View>
        )}
      </MovingRow>
    );
  };

  const showTotal = net !== 0 && !(lines.length === 1 && transfers.length === 0);
  const totalText = `${net > 0 ? '+' : '−'}${formatMoney(Math.abs(net))}`;
  // The date beside the entries instead of above them. Narrow screens and large text keep the heading, so a
  // row never loses the width it needs.
  const beside = timeline && !stacked;
  // With one line the total would only repeat it, so it appears from two lines up.
  const showTileTotal = lines.length >= 2 && net !== 0;
  const day = parseLocalIsoDate(date);
  return (
    <ReanimatedAnimated.View entering={entering} style={[styles.day, beside && styles.dayBeside]}>
      {beside ? (
        <>
          {/* The date on the left edge, where the eye scans a list; the day's total only when it adds something. */}
          <View
            style={[styles.dateCol, { width: Math.round(DATE_W * Math.min(1.2, Math.max(1, fontScale))) }]}
            accessible
            accessibilityRole="header"
            accessibilityLabel={`${label}, ${dateLabel}${showTileTotal ? `, ${totalText}` : ''}`}
          >
            <Text style={[styles.dateWd, isToday && styles.dateWdToday]}>
              {isToday ? 'TODAY' : day.toLocaleDateString(undefined, { weekday: 'short' }).toUpperCase()}
            </Text>
            <Text style={styles.dateNum}>{day.getDate()}</Text>
            {showTileTotal && (
              <Text
                style={[styles.dateTotal, net > 0 && styles.income]}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.75}
              >
                {net > 0 ? '+' : '−'}
                {compactMoney(Math.abs(net))}
              </Text>
            )}
          </View>
          <View
            style={styles.rail}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          >
            {position !== 'only' && (
              <View
                style={[
                  styles.railLine,
                  position === 'first' && { top: DOT_TOP + DOT / 2 },
                  position === 'last' && { bottom: undefined, height: DOT_TOP + DOT / 2 },
                ]}
              />
            )}
            <View
              style={[
                styles.railDot,
                isToday && {
                  backgroundColor: accent,
                  borderColor: accent,
                  boxShadow: `0px 0px 0px 4px ${shade(accent, 86)}`,
                },
                selected && { borderColor: theme.colors.ink },
              ]}
            />
          </View>
        </>
      ) : (
        <View style={styles.head}>
          <Text style={styles.title}>
            {label}
            {'  '}
            <Text style={styles.date}>{dateLabel}</Text>
          </Text>
          {showTotal && <Text style={[styles.total, net > 0 && styles.income]}>{totalText}</Text>}
        </View>
      )}
      <View
        style={[
          styles.lane,
          beside && styles.laneBeside,
          beside && position !== 'only' && position !== 'last' && styles.laneGap,
        ]}
      >
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
        {transfers.map((tx, i) => {
          const role = investRole(tx, investmentIds);
          const text = role
            ? investLines(tx, role, accountName)
            : {
                title: `${accountName(tx.accountId)} → ${accountName(tx.toAccountId!)}`,
                sub: `${tx.note ? `${tx.note} · ` : ''}Transfer`,
              };
          return (
            <View key={tx.id}>
              {(lines.length > 0 || i > 0) && <View style={styles.separator} />}
              <Pressable
                onPress={() => onPressTx(tx)}
                style={withPressedTint(accent, [styles.line, stacked && styles.wrapLine])}
                accessibilityRole="button"
                accessibilityLabel={`${money(tx.amountMinor, hidden(tx), tx.accountId)} ${
                  role === 'invest'
                    ? `invested in ${accountName(tx.toAccountId!)}${tx.ruleId ? ' by SIP' : ''}, from ${accountName(tx.accountId)}`
                    : role === 'withdraw'
                      ? `withdrawn from ${accountName(tx.accountId)} to ${accountName(tx.toAccountId!)}`
                      : `moved from ${accountName(tx.accountId)} to ${accountName(tx.toAccountId!)}`
                }`}
              >
                <JustAddedGlow ids={[tx.id]} surface="activity" />
                <View style={styles.lead}>
                  <View style={[styles.transferIcon, { backgroundColor: softTint(secondary, 0.35) }]}>
                    <Feather
                      name={
                        role === 'invest' ? 'trending-up' : role === 'withdraw' ? 'trending-down' : 'repeat'
                      }
                      size={16}
                      color={theme.colors.ink}
                    />
                  </View>
                </View>
                <View style={[styles.mid, stacked && styles.wideMid]}>
                  <Text style={[styles.name, styles.transferName]}>{text.title}</Text>
                  <Text style={styles.sub}>{text.sub}</Text>
                </View>
                <Text style={[styles.amount, styles.transferAmount]} numberOfLines={1}>
                  {money(tx.amountMinor, hidden(tx), tx.accountId)}
                </Text>
              </Pressable>
            </View>
          );
        })}
        {notes.map((note, i) => {
          const masked = hideAmounts && savingsAccountIds.has(note.accountId);
          const change = note.previousMinor == null ? null : note.valueMinor - note.previousMinor;
          const cur = accountCurrency(note.accountId);
          return (
            <View key={note.id}>
              {(lines.length > 0 || transfers.length > 0 || i > 0) && <View style={styles.separator} />}
              <Pressable
                onPress={onPressNote ? () => onPressNote(note) : undefined}
                disabled={!onPressNote}
                accessibilityRole={onPressNote ? 'button' : undefined}
                accessibilityHint={onPressNote ? 'Opens your investments' : undefined}
                style={[styles.line, stacked && styles.wrapLine]}
                accessibilityLabel={`${accountName(note.accountId)} value updated to ${formatMaskableMoney(note.valueMinor, { masked, currency: cur })}`}
              >
                <View style={styles.lead}>
                  <View
                    style={[styles.transferIcon, { backgroundColor: softTint(theme.colors.idGold, 0.35) }]}
                  >
                    <Feather name="edit-3" size={15} color={theme.colors.ink} />
                  </View>
                </View>
                <View style={[styles.mid, stacked && styles.wideMid]}>
                  <Text style={[styles.name, styles.transferName]}>
                    {accountName(note.accountId)} now worth{' '}
                    {formatMaskableMoney(note.valueMinor, { masked, currency: cur })}
                  </Text>
                  <Text style={styles.sub}>
                    Value update
                    {change != null && !masked
                      ? ` · ${change < 0 ? '−' : '+'}${formatMoney(Math.abs(change), cur)} since ${dayMonth(note.previousDate!)}`
                      : ''}
                  </Text>
                </View>
              </Pressable>
            </View>
          );
        })}
      </View>
    </ReanimatedAnimated.View>
  );
}

const styles = StyleSheet.create({
  day: { paddingHorizontal: 16, paddingBottom: 10 },
  dayBeside: { flexDirection: 'row', alignItems: 'stretch', paddingBottom: 0 },
  laneBeside: { flex: 1, minWidth: 0 },
  // The gap to the next day is the card's own margin, so the rail beside it runs through it unbroken.
  laneGap: { marginBottom: 14 },
  dateCol: { alignItems: 'center', paddingTop: 8 },
  dateWd: {
    fontFamily: theme.font.bodyBold,
    fontSize: 11,
    letterSpacing: 0.6,
    color: theme.colors.textSecondary,
  },
  dateWdToday: { color: theme.colors.textPrimary },
  dateNum: {
    fontFamily: theme.font.roundedBold,
    fontSize: 18,
    lineHeight: 21,
    color: theme.colors.textPrimary,
  },
  dateTotal: {
    marginTop: 3,
    alignSelf: 'stretch',
    textAlign: 'center',
    fontFamily: theme.font.bodyMedium,
    fontSize: 11,
    color: theme.colors.textPrimary,
    fontVariant: ['tabular-nums'],
  },
  rail: { width: 20 },
  railLine: {
    position: 'absolute',
    left: 9,
    width: 2,
    top: 0,
    bottom: 0,
    borderRadius: 1,
    backgroundColor: theme.colors.inkHairline,
  },
  railDot: {
    position: 'absolute',
    left: 4,
    top: DOT_TOP,
    width: DOT,
    height: DOT,
    borderRadius: DOT / 2,
    borderWidth: 2,
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.inkOff,
  },
  head: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 4,
    paddingHorizontal: 4,
  },
  title: {
    flexGrow: 1,
    flexBasis: 160,
    // A quiet day label: the section heading's face at row-caption size.
    ...SECTION_TITLE,
    fontFamily: theme.font.bodyMedium,
    fontSize: 13,
  },
  date: { fontFamily: theme.font.body, fontSize: 12, color: theme.colors.textMuted },
  // Spending reads in ink with its minus sign; only money in is green.
  total: {
    fontFamily: theme.font.bodyBold,
    fontVariant: ['tabular-nums'],
    fontSize: 13,
    color: theme.colors.textPrimary,
  },
  lead: { width: ICON, alignItems: 'center', justifyContent: 'center' },
  transferIcon: {
    width: ICON,
    height: ICON,
    borderRadius: ICON / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  transferName: { fontFamily: theme.font.bodyMedium, color: theme.colors.textSecondary },
  transferAmount: { color: theme.colors.textSecondary },
  // Flat cream keeps category colours and amounts prominent, matching Home's supporting cards.
  lane: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.xl2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.borderSoft,
    // Rows sit 12 in from the card's edge, so their dividers are inset like Home's.
    paddingHorizontal: 12,
    // No shadow: at 4% it was invisible, and a shadow on a clipped, rounded row in a scrolling list costs a
    // clipping layer per day on Android.
    overflow: 'hidden',
  },
  // Starts under the icon, so it separates the text and leaves the icon column unbroken.
  separator: {
    height: StyleSheet.hairlineWidth,
    marginLeft: ICON + 10,
    backgroundColor: theme.colors.divider,
  },
  line: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 0,
    paddingVertical: 6,
    // A minimum target; text can wrap and measured row heights drive reordering.
    minHeight: ROW_H,
  },
  wrapLine: { flexWrap: 'wrap', rowGap: 6 },
  wideMid: { flexGrow: 1, flexBasis: '75%' },
  mid: { flex: 1, minWidth: 0 },
  stackMid: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 },
  stackChip: {
    minHeight: 20,
    paddingHorizontal: 6,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: theme.colors.surfaceAlt,
  },
  stackCount: { fontFamily: theme.font.bodyBold, fontSize: 11, color: theme.colors.textSecondary },
  entryHead: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 },
  name: {
    fontFamily: theme.font.bodyMedium,
    fontSize: theme.typeSize.row,
    lineHeight: 20,
    color: theme.colors.textPrimary,
  },
  stackName: { flexShrink: 1 },
  sub: {
    fontFamily: theme.font.body,
    fontSize: 12,
    lineHeight: 17,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  amount: {
    fontFamily: theme.font.bodyMedium,
    fontSize: 14,
    lineHeight: 20,
    color: theme.colors.textPrimary,
    fontVariant: ['tabular-nums'],
    flexShrink: 1,
    marginLeft: 'auto',
  },
  income: { color: theme.colors.incomeText },
  // An open stack's entries: the same card, dividers and text as every other
  // line, each with a dot in its category's colour under the stack's icon.
  subLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    // Centre the dot under the category icon; its trailing space aligns the entry text above.
    paddingLeft: (ICON - 6) / 2,
    paddingRight: 0,
    paddingVertical: 5,
    minHeight: 44,
  },
  // Ends where the icon ends, so the text lines up with the lines above.
  subDot: { width: 6, height: 6, borderRadius: 3, marginRight: (ICON - 6) / 2 },
});

/**
 * Memoized: typing in search, opening a sheet or dragging re-renders the screen, and a month holds dozens of
 * days. `entering` only plays on mount, so a new animation object on each render isn't a reason to redraw.
 */
export const TimelineDay = memo(TimelineDayView, (prev, next) => {
  for (const key of Object.keys(next) as (keyof typeof next)[]) {
    if (key === 'entering' || prev[key] === next[key]) continue;
    if (key === 'openStacks') {
      // Expansion belongs to a date. Opening another day's stack must not rebuild this day's rows.
      const prefix = `${next.date}|`;
      for (const stack of prev.openStacks) {
        if (stack.startsWith(prefix) && !next.openStacks.has(stack)) return false;
      }
      for (const stack of next.openStacks) {
        if (stack.startsWith(prefix) && !prev.openStacks.has(stack)) return false;
      }
      continue;
    }
    return false;
  }
  return Object.keys(prev).length === Object.keys(next).length;
});
