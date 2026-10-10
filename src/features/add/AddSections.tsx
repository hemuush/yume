import { useState } from 'react';
import { View, Pressable, Animated } from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import type { McIconName } from '@/components/iconName';
import { Amount } from '@/components/Amount';
import { ModalSheet } from '@/components/ModalSheet';
import { accountBadgeColor, accountIcon } from '@/lib/account';
import { Text } from '@/components/Text';
import Feather from '@expo/vector-icons/Feather';
import { theme } from '@/constants/theme';
import { formatMoney, formatMaskableMoney, getCurrencySymbol } from '@/lib/money';
import { usePrivacy } from '@/theme/PrivacyContext';
import { haptics } from '@/lib/haptics';
import { Account } from '@/types';
import { RepeatEntry } from '@/db/ledger';
import { CategoryIcon } from '@/components/CategoryIcon';
import { MovingRow } from '@/components/MovingRow';
import { styles } from './add.styles';
import { TYPE_WASH, typeWash, EntryType, Staged, dateChipLabel } from './addEntry';
import { withPressed } from '@/lib/pressed';
import { categorySentence, categorySpoken, inParent } from '@/lib/categoryLabel';
import { useAccent } from '@/theme/AccentContext';

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
  const { accent } = useAccent();
  const wash = refund ? TYPE_WASH.income : typeWash(type, accent);
  return (
    <View style={styles.heroCard}>
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

/**
 * A transfer's From and To as two account cards (name, kind, balance); tapping one opens a sheet of the
 * accounts to pick from, and Swap between them trades the two. To never offers the From account.
 */
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
  const [picking, setPicking] = useState<'from' | 'to' | null>(null);
  const from = accounts.find((a) => a.id === fromId);
  const to = accounts.find((a) => a.id === toId);
  const canSwap = !!fromId && !!toId && fromOptions.some((a) => a.id === toId);
  const options = picking === 'from' ? fromOptions : accounts.filter((a) => a.id !== fromId);
  return (
    <View style={styles.transfer}>
      <TransferCard label="From" account={from} onPress={() => setPicking('from')} />
      <TransferCard label="To" account={to} onPress={() => setPicking('to')} />
      {canSwap && (
        <Pressable
          onPress={() => {
            haptics.tap();
            onPickFrom(toId!);
            onPickTo(fromId!);
          }}
          hitSlop={8}
          style={withPressed(styles.swapBtn)}
          accessibilityRole="button"
          accessibilityLabel="Swap From and To"
        >
          <Feather name="repeat" size={15} color={theme.colors.white} />
        </Pressable>
      )}
      <ModalSheet
        visible={picking !== null}
        onClose={() => setPicking(null)}
        title={picking === 'from' ? 'Move from' : 'Move to'}
        scrollable={false}
      >
        <AccountPickList
          accounts={options}
          activeId={picking === 'from' ? fromId : toId}
          onPick={(id) => {
            if (picking === 'from') onPickFrom(id);
            else onPickTo(id);
            setPicking(null);
          }}
        />
      </ModalSheet>
    </View>
  );
}

function TransferCard({
  label,
  account,
  onPress,
}: {
  label: string;
  account?: Account;
  onPress: () => void;
}) {
  const { accent } = useAccent();
  return (
    <Pressable
      onPress={onPress}
      style={withPressed(styles.transferCard)}
      accessibilityRole="button"
      accessibilityLabel={`${label}, ${account ? account.name : 'pick an account'}. Change`}
    >
      <View
        style={[
          styles.transferIcon,
          { backgroundColor: account ? accountBadgeColor(account.type, accent) : theme.colors.surfaceAlt },
        ]}
      >
        <MaterialCommunityIcons
          name={(account ? accountIcon(account.type) : 'bank-outline') as McIconName}
          size={18}
          color={theme.colors.ink}
        />
      </View>
      <View style={styles.transferMid}>
        <Text style={styles.transferLabel}>{label}</Text>
        <Text style={styles.transferName} numberOfLines={1}>
          {account ? account.name : 'Pick an account'}
        </Text>
        {account && (
          <Amount
            minor={account.currentBalanceMinor}
            currency={account.currency}
            sensitive={account.type === 'savings'}
            style={styles.transferBal}
            numberOfLines={1}
          />
        )}
      </View>
      <Feather name="chevron-down" size={16} color={theme.colors.textMuted} />
    </Pressable>
  );
}

/** Accounts as rows with their kind and balance, the picked one outlined: Add's account sheets. */
export function AccountPickList({
  accounts,
  activeId,
  onPick,
}: {
  accounts: Account[];
  activeId: string | null;
  onPick: (id: string) => void;
}) {
  const { accent } = useAccent();
  return (
    <View style={styles.pickList}>
      {accounts.map((a) => {
        const on = a.id === activeId;
        return (
          <Pressable
            key={a.id}
            onPress={() => {
              haptics.tap();
              onPick(a.id);
            }}
            style={withPressed([styles.pickRow, on && styles.pickRowOn])}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            accessibilityLabel={a.name}
          >
            <View style={[styles.transferIcon, { backgroundColor: accountBadgeColor(a.type, accent) }]}>
              <MaterialCommunityIcons
                name={accountIcon(a.type) as McIconName}
                size={18}
                color={theme.colors.ink}
              />
            </View>
            <View style={styles.transferMid}>
              <Text style={styles.transferName} numberOfLines={1}>
                {a.name}
              </Text>
              <Text style={styles.pickSub} numberOfLines={1}>
                {a.type.replace('_', ' ')} ·{' '}
                <Amount
                  minor={a.currentBalanceMinor}
                  currency={a.currency}
                  sensitive={a.type === 'savings'}
                  style={styles.pickSub}
                />
              </Text>
            </View>
            {on && <Feather name="check" size={18} color={theme.colors.ink} />}
          </Pressable>
        );
      })}
    </View>
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
  const { secondary } = useAccent();
  const { hideAmounts } = usePrivacy();
  const usualMoney = (u: RepeatEntry) =>
    formatMaskableMoney(u.amountMinor, { currency: u.accountCurrency, masked: hideAmounts && u.isSensitive });
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
              style={withPressed([
                styles.recentChip,
                active && [styles.recentChipActive, { borderColor: secondary }],
              ])}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              accessibilityLabel={`${categorySpoken(u.categoryName, u.parentName)}, ${usualMoney(u)}, logged ${u.timesLogged} times`}
            >
              <CategoryIcon name={u.categoryIcon} color={u.categoryColor} size={11} square={20} />
              <Text style={styles.recentChipText} numberOfLines={1}>
                {categorySentence(u.categoryName, u.parentName)} ·
              </Text>
              <Text style={styles.recentChipAmount}>{usualMoney(u)}</Text>
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
  const { secondary } = useAccent();
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
