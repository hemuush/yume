import { memo, useCallback, useMemo, useState } from 'react';
import { keepTogether } from '@/lib/keepTogether';
import { Pressable, View } from 'react-native';
import ReanimatedAnimated, { LayoutAnimationConfig } from 'react-native-reanimated';
import Feather from '@expo/vector-icons/Feather';
import { Text } from '@/components/Text';
import { CategoryIcon } from '@/components/CategoryIcon';
import { StatusBadge } from '@/components/StatusBadge';
import { MovingRow } from '@/components/MovingRow';
import { Collapsible } from '@/components/Collapsible';
import { useStackOpen, type StackStore } from './stackStore';
import { JustAddedGlow } from '@/components/JustAddedGlow';
import { Category, Transaction } from '@/types';
import { dayMonth } from '@/lib/dateLabels';
import { formatMaskableMoney, formatMoney } from '@/lib/money';
import { getCachedCurrency } from '@/db/settings';
import { usePrivacy } from '@/theme/PrivacyContext';
import { useAccent } from '@/theme/AccentContext';
import { haptics } from '@/lib/haptics';
import { theme } from '@/constants/theme';
import { buildDayLane, LaneLine, laneKey, type ValueNote } from './transactions.helpers';
import { sameElements } from '@/lib/stableData';
import { useDayReorder } from './useDayReorder';
import { styles } from './TimelineDay.styles';
import { screenStyles as h, SCREEN } from '@/components/screenStyles';
import { investLines, investRole } from '@/lib/investment';
import { isSavingsEntry } from '@/lib/privateSummary';
import { DraggableLine } from './DraggableLine';
import { withPressedTint } from '@/lib/pressed';
import { categoryPath, categorySpoken, joinSub, parentNameOf } from '@/lib/categoryLabel';
import { useStacked } from '@/lib/useStacked';

const NO_ACCOUNTS: ReadonlySet<string> = new Set();
const NO_NOTES: ValueNote[] = [];

/** What the day cost, what came in, and what came back as refunds. Transfers move nothing. */
function dayTotalsOf(items: Transaction[]) {
  let spent = 0;
  let received = 0;
  let back = 0;
  for (const tx of items) {
    if (tx.type === 'expense') spent += tx.amountMinor;
    else if (tx.type === 'income') {
      if (tx.isRefund) back += tx.amountMinor;
      else received += tx.amountMinor;
    }
  }
  return { spent, received, back };
}

/** The amount at the right of a line: spending in ink with its minus, money in green with its plus. */
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
    <Text style={[styles.amount, type === 'income' && styles.income]} numberOfLines={1}>
      {type === 'income' ? '+' : type === 'expense' ? '−' : ''}
      {formatMaskableMoney(minor, { masked, currency })}
    </Text>
  );
}

/**
 * One Activity day, drawn like Home's Recent activity: one card with the day named inside it ("TODAY", and what it
 * spent at the right, left out for one line) above its entries, transfers and value updates after them. 2+
 * same-category entries stack into an openable line; the screen holds open stacks (rows unmount).
 */
function TimelineDayView({
  date,
  label,
  dateLabel,
  dateInHeading = true,
  items,
  categories,
  accountName,
  categoryName,
  onPressTx,
  stacks,
  entering,
  onReorder,
  onDragActive,
  savingsAccountIds = NO_ACCOUNTS,
  investmentIds = NO_ACCOUNTS,
  notes = NO_NOTES,
  onPressNote,
  accountCurrency = () => getCachedCurrency(),
  selected = false,
}: {
  date: string;
  /** "Today", "Yesterday", or the weekday: the day's name in the heading. */
  label: string;
  /** The date ("Sun 15 Nov"): read out with the heading, and written after the name unless `dateInHeading` is off. */
  dateLabel: string;
  /** Off for today and yesterday, which say enough on their own, as in Home. */
  dateInHeading?: boolean;
  items: Transaction[];
  categories: Category[];
  accountName: (id: string) => string;
  categoryName: (id: string | null) => string;
  onPressTx: (tx: Transaction) => void;
  /** Which stacked lines are open (see stackStore). */
  stacks: StackStore;
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
  /** The chart's picked day: its heading sits on a soft tint, so the list answers the tap. */
  selected?: boolean;
}) {
  const { hideAmounts } = usePrivacy();
  const stacked = useStacked();
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
  const totals = dayTotalsOf(
    items.filter(
      (tx) => accountCurrency(tx.accountId) === getCachedCurrency() && (!hideAmounts || !hidden(tx))
    )
  );

  const { shown, settling, liftedIndex, dy, shiftOf, reorderProps, rememberHeight, moveTo, drop } =
    useDayReorder({
      items,
      date,
      lines,
      transfers,
      onReorder,
      onDragActive,
    });
  // Lines slide into place when an entry above them goes or comes (and not just after a hand-ordering, which has
  // moved them already). A day with a group does not: opening one changes the height of its panel every frame, and
  // each line below would start a slide of its own towards that moving position and trail behind the panel's edge.
  const slides = !settling && !shown.some((line) => line.kind === 'stack');

  const renderLine = (line: LaneLine, i: number) => {
    if (line.kind === 'single') {
      const tx = line.tx;
      const cat = tx.categoryId ? categoriesById.get(tx.categoryId) : undefined;
      const category = categoryName(tx.categoryId);
      // As Home's Recent activity words it: the entry's own name leads (its note, else its category); under it the
      // category (after a note, with its parent) or just the parent, then the account.
      const sub = joinSub([
        tx.note ? category && categoryPath(category, parentLine(tx.categoryId)) : parentLine(tx.categoryId),
        accountName(tx.accountId),
      ]);
      return (
        <MovingRow key={tx.id} moving={slides}>
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
              <CategoryIcon
                name={cat?.icon ?? 'tag'}
                color={cat?.color ?? theme.colors.textMuted}
                square={SCREEN.mark}
                round
              />
            </View>
            <View style={[styles.mid, stacked && styles.wideMid]}>
              <View style={styles.entryHead}>
                <Text style={[styles.name, styles.stackName]}>{tx.note || category}</Text>
                {tx.isRefund && <StatusBadge label="Refund" tone="complete" />}
                {tx.splitId && <StatusBadge label="Split" />}
              </View>
              <Text style={styles.sub}>{sub}</Text>
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
    const first = line.items[0];
    const name = categoryName(line.categoryId);
    const stackParent = parentNameOf(line.categoryId, categoriesById);
    const lineMasked = line.items.some(hidden);
    // A stack from one account names it, like a single entry does; from several, just the count.
    const sameAccount = line.items.every((t) => t.accountId === first.accountId);
    return (
      // moving={false}: the open panel animates its own height (Collapsible), so a layout animation on the row
      // would chase it a frame behind.
      <MovingRow key={line.key} moving={false}>
        {i > 0 && <View style={styles.separator} />}
        {/* Only this line re-renders when it opens or closes: the day, and the screen, are left alone. */}
        <OpenStack stacks={stacks} id={line.key}>
          {({ open, warm, warmUp }) => (
            <>
              <Pressable
                onPressIn={warmUp}
                onPress={() => {
                  haptics.tap();
                  stacks.toggle(line.key);
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
                  <CategoryIcon
                    name={cat?.icon ?? 'tag'}
                    color={cat?.color ?? theme.colors.textMuted}
                    square={SCREEN.mark}
                    round
                  />
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
              {/* The panel opens and closes by animating its own height, so the rows below move with it, frame by frame. */}
              <Collapsible open={open} warm={warm}>
                {() =>
                  line.items.map((tx) => {
                    // The category is already named above: the note leads with the account under it, or with no
                    // note the account is the name.
                    const label = tx.note || accountName(tx.accountId);
                    return (
                      <View key={tx.id}>
                        <View style={styles.separator} />
                        <Pressable
                          onPress={() => onPressTx(tx)}
                          style={withPressedTint(accent, [styles.subLine, stacked && styles.wrapLine])}
                          accessibilityRole="button"
                          accessibilityLabel={`${categorySpoken(name, stackParent)}${tx.isRefund ? ', refund' : ''}${tx.note ? `, ${tx.note}` : ''}, ${money(tx.amountMinor, hidden(tx), tx.accountId)}`}
                        >
                          <View style={styles.subLead}>
                            <View
                              style={[
                                styles.subDot,
                                { backgroundColor: cat?.color ?? theme.colors.borderSoft },
                              ]}
                            />
                          </View>
                          <View style={[styles.mid, stacked && styles.wideMid]}>
                            <View style={styles.entryHead}>
                              <Text style={[styles.name, styles.stackName]}>{label}</Text>
                              {tx.splitId && <StatusBadge label="Split" />}
                            </View>
                            {!!tx.note && <Text style={styles.sub}>{accountName(tx.accountId)}</Text>}
                          </View>
                          <Amount
                            type={tx.type}
                            minor={tx.amountMinor}
                            masked={hidden(tx)}
                            currency={accountCurrency(tx.accountId)}
                          />
                        </Pressable>
                      </View>
                    );
                  })
                }
              </Collapsible>
            </>
          )}
        </OpenStack>
      </MovingRow>
    );
  };

  // What the day did, as Home's day heading writes it ("−₹1,420"), with money in as "+₹82,000" and refunds as
  // "₹899 back" (they are not income), instead of one unlabelled net.
  const parts = [
    totals.spent > 0 && {
      word: 'spent',
      amount: formatMoney(totals.spent),
      drawn: `−${formatMoney(totals.spent)}`,
    },
    totals.received > 0 && {
      word: 'in',
      amount: formatMoney(totals.received),
      drawn: `+${formatMoney(totals.received)}`,
    },
    totals.back > 0 && {
      word: 'back',
      amount: formatMoney(totals.back),
      drawn: `${formatMoney(totals.back)} back`,
    },
  ].filter(Boolean) as { word: string; amount: string; drawn: string }[];
  // One line alone would only repeat its own amount, so it has no total. A day of only transfers has nothing spent to
  // total: it says how many there were instead.
  const onlyTransfers = parts.length === 0 && lines.length === 0 && transfers.length > 1;
  const showTotal = onlyTransfers || (parts.length > 0 && !(lines.length === 1 && transfers.length === 0));
  // Spoken in words ("₹82,000 in"), drawn as signed figures.
  const totalSpoken = onlyTransfers
    ? `${transfers.length} transfers`
    : parts.map((part) => `${part.amount} ${part.word}`).join(' · ');
  const totalText = onlyTransfers ? totalSpoken : parts.map((part) => part.drawn).join(' · ');
  return (
    // The day grows and shrinks with its stacks open or closed as their panels animate their own height (Collapsible),
    // and the days below, which are the list's own cells, move with it.
    // skipExiting: when the whole day leaves (the period changed, or the list scrolled it out of its window) its lines
    // go with it. Without this each line plays its fade-out first, and the removed day is kept on screen, over the
    // new one, until they have all finished.
    <LayoutAnimationConfig skipExiting>
      <ReanimatedAnimated.View entering={entering} style={styles.day}>
        <View style={styles.lane}>
          <View
            style={[h.dayHead, selected && styles.headOn]}
            accessible
            accessibilityRole="header"
            accessibilityLabel={`${label}, ${dateLabel}${showTotal ? `, ${totalSpoken}` : ''}`}
          >
            <Text style={styles.dayLabel}>{dateInHeading ? `${label} · ${dateLabel}` : label}</Text>
            {showTotal && <Text style={styles.dayLabel}>{totalText}</Text>}
          </View>
          {shown.map((line, i) => (
            <DraggableLine
              key={laneKey(line)}
              lifted={liftedIndex === i}
              shift={shiftOf(i)}
              dy={dy}
              onHeight={(h) => rememberHeight(line, h)}
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
                  // As Home's row: "Transfer" (or the note) over "SBI → Emergency fund". The arrow stays with where it
                  // goes: the line wraps after "SBI", never leaving "fund" alone.
                  title: tx.note?.trim() || 'Transfer',
                  sub: keepTogether(`${accountName(tx.accountId)} → ${accountName(tx.toAccountId!)}`),
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
                    <CategoryIcon
                      name={
                        role === 'invest'
                          ? 'trending-up'
                          : role === 'withdraw'
                            ? 'trending-down'
                            : 'swap-horizontal'
                      }
                      color={secondary}
                      square={SCREEN.mark}
                      round
                    />
                  </View>
                  <View style={[styles.mid, stacked && styles.wideMid]}>
                    <Text style={styles.name}>{text.title}</Text>
                    <Text style={styles.sub}>{text.sub}</Text>
                  </View>
                  <Text style={styles.amount} numberOfLines={1}>
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
                    <CategoryIcon name="pencil" color={theme.colors.idGold} square={SCREEN.mark} round />
                  </View>
                  <View style={[styles.mid, stacked && styles.wideMid]}>
                    <Text style={styles.name}>
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
    </LayoutAnimationConfig>
  );
}

/**
 * A stack's line and its panel, re-rendered alone when that stack opens or closes. A finger touching the line puts its
 * entries in the tree and measures them (`warm`), so the tap that follows only has to start the glide.
 */
function OpenStack({
  stacks,
  id,
  children,
}: {
  stacks: StackStore;
  id: string;
  children: (state: { open: boolean; warm: boolean; warmUp: () => void }) => React.ReactNode;
}) {
  const open = useStackOpen(stacks, id);
  const [warm, setWarm] = useState(false);
  const warmUp = useCallback(() => setWarm(true), []);
  return <>{children({ open, warm, warmUp })}</>;
}

/**
 * Memoized: typing in search, opening a sheet or dragging re-renders the screen, and a month holds dozens of
 * days. `entering` only plays on mount, so a new animation object on each render isn't a reason to redraw.
 */
export const TimelineDay = memo(TimelineDayView, (prev, next) => {
  for (const key of Object.keys(next) as (keyof typeof next)[]) {
    if (key === 'entering' || prev[key] === next[key]) continue;
    // A day made of the same entries is the same day, whether or not its list was rebuilt around them.
    if (
      (key === 'items' || key === 'notes') &&
      sameElements(prev[key] as readonly unknown[] | undefined, next[key] as readonly unknown[] | undefined)
    ) {
      continue;
    }
    return false;
  }
  return Object.keys(prev).length === Object.keys(next).length;
});
