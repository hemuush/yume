import { useEffect, useRef, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { Text } from '@/components/Text';
import ReanimatedAnimated, { useSharedValue, useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { getAccountFlow, listTransactions } from '@/db/ledger';
import { Account, Category, Transaction } from '@/types';
import { theme, modalFooterStyles as f } from '@/constants/theme';
import { ModalSheet } from '@/components/ModalSheet';
import { PrimaryButton } from '@/components/PrimaryButton';
import { CountUpAmount } from '@/components/CountUpAmount';
import { formatMaskableMoney } from '@/lib/money';
import { usePrivacy } from '@/theme/PrivacyContext';
import { useReduceMotion } from '@/lib/useReduceMotion';
import { MOTION, timing } from '@/lib/animation';
import { PeriodCursor, periodLabel, periodRange } from '@/lib/period';
import { RecentTransactionRow } from './RecentTransactionRow';

/**
 * A quick look at one account, opened by tapping its card on Home: the
 * balance, money in and out over the period Home is showing, and the latest
 * few entries against it. Read-only on purpose — renaming, retyping or
 * archiving stays in the full edit form (AccountDetailModal), one tap away
 * via "Edit account".
 *
 * A savings balance is masked exactly as on its card when "hide amounts" is
 * on, and so are its in/out figures (they'd give the balance away).
 */
export function AccountSummarySheet({
  account,
  cursor,
  accounts,
  categories,
  onClose,
  onAdd,
  onEdit,
}: {
  account: Account | null;
  cursor: PeriodCursor;
  accounts: Account[];
  categories: Category[];
  onClose: () => void;
  /** "Add expense here" (or "Transfer from here" for a savings account). */
  onAdd: (account: Account) => void;
  onEdit: (account: Account) => void;
}) {
  const { hideAmounts } = usePrivacy();
  const [flow, setFlow] = useState<{ inMinor: number; outMinor: number } | null>(null);
  const [latest, setLatest] = useState<Transaction[] | null>(null);
  const loadSeq = useRef(0);

  const accountId = account?.id;
  const { start, end } = periodRange(cursor);
  useEffect(() => {
    if (!accountId) return;
    const seq = ++loadSeq.current;
    setFlow(null);
    setLatest(null);
    Promise.all([getAccountFlow(accountId, { start, end }), listTransactions({ accountId, limit: 3 })])
      .then(([fl, tx]) => {
        if (seq !== loadSeq.current) return;
        setFlow(fl);
        setLatest(tx);
      })
      .catch(() => {
        if (seq !== loadSeq.current) return;
        setFlow({ inMinor: 0, outMinor: 0 });
        setLatest([]);
      });
  }, [accountId, start, end]);

  if (!account) return null;

  const masked = hideAmounts && account.type === 'savings';
  const money = (minor: number) => formatMaskableMoney(minor, { currency: account.currency, masked });
  const maxFlow = Math.max(flow?.inMinor ?? 0, flow?.outMinor ?? 0);
  const isSavings = account.type === 'savings';
  const nameOf = (id: string | null) => accounts.find((a) => a.id === id)?.name;

  return (
    <ModalSheet
      visible
      onClose={onClose}
      title={account.name}
      subtitle={account.type.replace('_', ' ').replace(/^./, (c) => c.toUpperCase())}
      footer={
        <View style={f.footerRow}>
          <PrimaryButton
            title="Edit account"
            variant="secondary"
            onPress={() => onEdit(account)}
            style={f.footerBtn}
          />
          <PrimaryButton
            title={isSavings ? 'Transfer from here' : 'Add expense here'}
            onPress={() => onAdd(account)}
            style={f.footerBtn}
          />
        </View>
      }
    >
      <Text style={styles.label}>Balance</Text>
      {masked ? (
        <Text style={styles.balance}>{money(account.currentBalanceMinor)}</Text>
      ) : (
        <CountUpAmount
          minor={account.currentBalanceMinor}
          currency={account.currency}
          style={styles.balance}
          numberOfLines={1}
          adjustsFontSizeToFit
        />
      )}

      <Text style={[styles.label, styles.sectionGap]}>In {periodLabel(cursor)}</Text>
      <View style={styles.flows}>
        <FlowRow
          label="In"
          value={flow ? `+${money(flow.inMinor)}` : '…'}
          fraction={flow && maxFlow > 0 ? flow.inMinor / maxFlow : 0}
          color={theme.colors.income}
          fillColor={theme.colors.secondary}
        />
        <FlowRow
          label="Out"
          value={flow ? `−${money(flow.outMinor)}` : '…'}
          fraction={flow && maxFlow > 0 ? flow.outMinor / maxFlow : 0}
          color={theme.colors.expense}
          fillColor={theme.colors.idCoralDeep}
        />
      </View>

      <Text style={[styles.label, styles.sectionGap]}>Latest here</Text>
      {latest === null ? null : latest.length === 0 ? (
        <Text style={styles.empty}>Nothing recorded against this account yet.</Text>
      ) : (
        <View style={styles.latest}>
          {latest.map((tx, i) => (
            <RecentTransactionRow
              key={tx.id}
              tx={tx}
              category={categories.find((c) => c.id === tx.categoryId)}
              accountName={nameOf(tx.accountId)}
              toAccountName={nameOf(tx.toAccountId)}
              divider={i > 0}
            />
          ))}
        </View>
      )}
    </ModalSheet>
  );
}

/** One in/out line: label, a bar that grows to its share of the larger of the two, the amount. */
function FlowRow({
  label,
  value,
  fraction,
  color,
  fillColor,
}: {
  label: string;
  value: string;
  fraction: number;
  color: string;
  fillColor: string;
}) {
  const reduce = useReduceMotion();
  const grow = useSharedValue(0);
  useEffect(() => {
    grow.value = reduce ? fraction : withTiming(fraction, timing(MOTION.draw));
  }, [fraction, reduce, grow]);
  const fillStyle = useAnimatedStyle(() => ({ transform: [{ scaleX: grow.value }] }));

  return (
    <View style={styles.flowRow}>
      <Text style={styles.flowLabel}>{label}</Text>
      <View style={styles.track}>
        <ReanimatedAnimated.View style={[styles.fill, { backgroundColor: fillColor }, fillStyle]} />
      </View>
      <Text style={[styles.flowValue, { color }]} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  label: {
    fontFamily: theme.font.bodyBold,
    fontSize: 11,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: theme.colors.textMuted,
  },
  sectionGap: { marginTop: 18 },
  balance: { fontFamily: theme.font.monoBold, fontSize: 26, color: theme.colors.textPrimary, marginTop: 4 },
  flows: { gap: 10, marginTop: 10 },
  flowRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  flowLabel: {
    fontFamily: theme.font.bodyMedium,
    fontSize: 12.5,
    color: theme.colors.textSecondary,
    width: 30,
  },
  track: {
    flex: 1,
    height: 8,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.inkWash,
    overflow: 'hidden',
  },
  fill: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, transformOrigin: 'left' },
  flowValue: { fontFamily: theme.font.monoBold, fontSize: 13, minWidth: 92, textAlign: 'right' },
  latest: {
    marginTop: 8,
    marginHorizontal: -4,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.borderSoft,
    overflow: 'hidden',
  },
  empty: { fontFamily: theme.font.body, fontSize: 13, color: theme.colors.textMuted, marginTop: 8 },
});
