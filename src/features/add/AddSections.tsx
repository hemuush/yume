import { View, Pressable, Animated } from 'react-native';
import { Text } from '@/components/Text';
import Feather from '@expo/vector-icons/Feather';
import { theme } from '@/constants/theme';
import { formatMoney, getCurrencySymbol } from '@/lib/money';
import { haptics } from '@/lib/haptics';
import { Account } from '@/types';
import { RepeatEntry } from '@/db/ledger';
import { CategoryIcon } from '@/components/CategoryIcon';
import { MovingRow } from '@/components/MovingRow';
import { styles } from './add.styles';
import { TYPE_WASH, EntryType, Staged, dateChipLabel } from './addEntry';
import { AccountTile } from './AddFields';
import { withPressed } from '@/lib/pressed';
import { categorySentence, categorySpoken, inParent } from '@/lib/categoryLabel';

/**
 * The Add screen's display pieces: amount card, From/To pickers, "Your usual" chips, staged-entry list.
 * All state and saving stay in app/add-transaction.tsx; these only show it and report taps.
 */

/**
 * The white card under the sky header: the amount being typed, and this category's usual amounts. A strip
 * along its top edge, the kicker and the caret take the entry type's colour (the type switch is in the header).
 */
export function AmountCard({
  type,
  currency,
  expr,
  isSum,
  shownAmount,
  padVisible,
  isLinked,
  onOpenPad,
  frequentAmounts,
  amountMinor,
  onPickAmount,
  refund = false,
}: {
  type: EntryType;
  currency: string | undefined;
  /** Exactly what was typed, e.g. "120+45". */
  expr: string;
  /** Whether `expr` is a sum (see padMath.hasOperator), shown written out under the amount. */
  isSum: boolean;
  /** The amount to show: the typed number, or a sum's result. */
  shownAmount: string;
  padVisible: boolean;
  isLinked: boolean;
  onOpenPad: () => void;
  frequentAmounts: number[];
  amountMinor: number;
  onPickAmount: (minor: number) => void;
  /** "Money back" is on: the card turns the income green and says so. */
  refund?: boolean;
}) {
  const wash = refund ? TYPE_WASH.income : TYPE_WASH[type];
  return (
    <View style={styles.heroCard}>
      <View style={[styles.heroStrip, { backgroundColor: wash.accent }]} />
      <View style={styles.heroLabelRow}>
        <View style={[styles.heroDot, { backgroundColor: wash.accent }]} />
        <Text style={[styles.heroLabel, { color: wash.accent }]}>
          {refund
            ? 'Money back'
            : type === 'friend'
              ? 'Amount'
              : `${type[0].toUpperCase()}${type.slice(1)} amount`}
        </Text>
      </View>
      <Pressable
        onPress={onOpenPad}
        disabled={isLinked}
        style={withPressed(styles.amountRow)}
        accessibilityRole="button"
        accessibilityLabel={`Amount, ${expr === '' ? 'empty' : shownAmount}`}
        accessibilityHint={padVisible ? undefined : 'Opens the number pad'}
      >
        <Text style={[styles.amountCurrency, { color: wash.accent }]}>{getCurrencySymbol(currency)}</Text>
        <Text
          style={[styles.amountText, expr === '' && styles.amountPlaceholder]}
          numberOfLines={1}
          adjustsFontSizeToFit
        >
          {shownAmount}
        </Text>
        {padVisible && <View style={[styles.caret, { backgroundColor: wash.accent }]} />}
      </Pressable>
      {isSum && <Text style={styles.expression}>{expr.replace(/([+−×÷])/g, ' $1 ')}</Text>}

      {frequentAmounts.length > 0 && (
        <View style={styles.frequentRow}>
          {frequentAmounts.map((minor) => {
            const active = amountMinor === minor;
            return (
              <Pressable
                key={minor}
                onPress={() => {
                  haptics.tap();
                  onPickAmount(minor);
                }}
                style={withPressed([styles.frequentChip, active && styles.frequentChipActive])}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
              >
                <Text style={[styles.frequentChipText, active && styles.frequentChipTextActive]}>
                  {formatMoney(minor, currency)}
                </Text>
              </Pressable>
            );
          })}
        </View>
      )}
    </View>
  );
}

/** A transfer's From and To account rows; To never offers the From account. */
export function TransferAccounts({
  fromOptions,
  accounts,
  fromId,
  toId,
  onPickFrom,
  onPickTo,
}: {
  /** Accounts money can leave: every one, for a transfer. */
  fromOptions: Account[];
  accounts: Account[];
  fromId: string | null;
  toId: string | null;
  onPickFrom: (id: string) => void;
  onPickTo: (id: string) => void;
}) {
  return (
    <>
      <View style={styles.section}>
        <Text style={styles.label}>From</Text>
        <View style={styles.accountRow}>
          {fromOptions.map((acc) => (
            <AccountTile
              key={acc.id}
              account={acc}
              active={fromId === acc.id}
              onPress={() => onPickFrom(acc.id)}
            />
          ))}
        </View>
      </View>
      <View style={styles.section}>
        <Text style={styles.label}>To</Text>
        <View style={styles.accountRow}>
          {accounts
            .filter((a) => a.id !== fromId)
            .map((acc) => (
              <AccountTile
                key={acc.id}
                account={acc}
                active={toId === acc.id}
                onPress={() => onPickTo(acc.id)}
              />
            ))}
        </View>
      </View>
    </>
  );
}

/**
 * "Your usual": recent entries of this type, one tap fills category, amount and account. The name is its own
 * Text so at large text sizes a long name is cut, never the amount.
 */
export function UsualChips({
  usual,
  categoryId,
  amountMinor,
  accountId,
  onPick,
}: {
  usual: RepeatEntry[];
  categoryId: string | null;
  amountMinor: number;
  accountId: string | null;
  onPick: (entry: RepeatEntry) => void;
}) {
  return (
    <>
      <Text style={styles.label}>Your usual</Text>
      <View style={styles.recentRow}>
        {usual.map((u) => {
          const active =
            categoryId === u.categoryId && amountMinor === u.amountMinor && accountId === u.accountId;
          return (
            <Pressable
              key={`${u.categoryId}:${u.amountMinor}:${u.accountId}`}
              onPress={() => {
                haptics.tap();
                onPick(u);
              }}
              style={withPressed([styles.recentChip, active && styles.recentChipActive])}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              accessibilityLabel={`${categorySpoken(u.categoryName, u.parentName)}, ${formatMoney(u.amountMinor, u.accountCurrency)}, logged ${u.timesLogged} times`}
            >
              <CategoryIcon name={u.categoryIcon} color={u.categoryColor} size={11} square={20} />
              <Text style={styles.recentChipText} numberOfLines={1}>
                {categorySentence(u.categoryName, u.parentName)} ·
              </Text>
              <Text style={styles.recentChipAmount}>{formatMoney(u.amountMinor, u.accountCurrency)}</Text>
            </Pressable>
          );
        })}
      </View>
    </>
  );
}

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
              color={r.kind === 'transaction' ? r.categoryColor : theme.colors.secondary}
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
              hitSlop={14}
              style={withPressed(styles.removeBtn)}
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
