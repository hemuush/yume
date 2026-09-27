import { useEffect, useMemo, useState } from 'react';
import { View, Alert, Pressable } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { Text } from '@/components/Text';
import {
  createTransaction,
  deleteTransaction,
  restoreTransaction,
  getTransactionLink,
  TransactionLink,
} from '@/db/ledger';
import { undoInstallmentPayment } from '@/db/loans';
import { undoPersonTransaction } from '@/db/people';
import { Account, Category, Transaction } from '@/types';
import { PrimaryButton } from '@/components/PrimaryButton';
import { CategoryIcon } from '@/components/CategoryIcon';
import { Amount } from '@/components/Amount';
import { ModalSheet } from '@/components/ModalSheet';
import { theme, modalFooterStyles as f } from '@/constants/theme';
import { useUndoToast } from '@/components/UndoToast';
import { haptics } from '@/lib/haptics';
import { emitTransactionsChanged } from '@/lib/dataEvents';
import { toLocalIsoDate, nextMonthlyDateAfter } from '@/lib/date';
import { RuleModal } from '@/features/recurring/RuleModal';
import { styles } from './transactions.styles';
import { errorMessage } from '@/lib/errorMessage';
import { useReturnOrPush } from '@/lib/useReturnOrPush';
import { withPressed } from '@/lib/pressed';
import { getSplitParts, deleteSplit, restoreSplit } from '@/db/splits';
import { formatMoney } from '@/lib/money';
import { router } from 'expo-router';

export function TransactionDetailModal({
  tx,
  accounts,
  categories,
  onClose,
  onEdit,
  onChanged,
}: {
  tx: Transaction | null;
  accounts: Account[];
  categories: Category[];
  onClose: () => void;
  onEdit: (tx: Transaction) => void;
  onChanged: () => void;
}) {
  const returnOrPush = useReturnOrPush();
  const { show: showUndo } = useUndoToast();
  const [link, setLink] = useState<TransactionLink | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [ruleOpen, setRuleOpen] = useState(false);

  // "Make it recurring": the same entry, monthly, from its next same day of
  // the month still ahead. Memoised — the rule form resets whenever this changes.
  const rulePrefill = useMemo(() => {
    if (!tx) return undefined;
    const next = nextMonthlyDateAfter(tx.date, toLocalIsoDate(new Date()));
    return {
      type: tx.type,
      accountId: tx.accountId,
      toAccountId: tx.toAccountId,
      categoryId: tx.categoryId,
      amountMinor: tx.amountMinor,
      note: tx.note,
      nextRunDate: next,
    };
  }, [tx]);

  useEffect(() => {
    if (!tx) {
      setLink(undefined);
      return;
    }
    setLink(undefined);
    getTransactionLink(tx.id)
      .then(setLink)
      .catch(() => {});
  }, [tx]);

  // A split part shows the whole payment it belongs to.
  const [splitParts, setSplitParts] = useState<Transaction[] | null>(null);
  useEffect(() => {
    setSplitParts(null);
    if (!tx?.splitId) return;
    let alive = true;
    getSplitParts(tx.splitId)
      .then((parts) => {
        if (alive) setSplitParts(parts);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [tx]);

  if (!tx) return null;

  const cat = categories.find((c) => c.id === tx.categoryId);
  const accountName = (id: string) => accounts.find((a) => a.id === id)?.name ?? '—';

  /** Saves the same entry for today, with an undo — like ↻ Repeat on Add. */
  const logAgainToday = async () => {
    setBusy(true);
    try {
      const again = await createTransaction({
        type: tx.type,
        accountId: tx.accountId,
        toAccountId: tx.toAccountId,
        categoryId: tx.categoryId,
        amountMinor: tx.amountMinor,
        date: toLocalIsoDate(new Date()),
        note: tx.note,
      });
      haptics.confirm();
      emitTransactionsChanged();
      onChanged();
      showUndo('Logged again for today', async () => {
        await deleteTransaction(again.id, { keep: false });
        emitTransactionsChanged();
        onChanged();
      });
    } catch (e) {
      Alert.alert("Couldn't log it", errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const confirmDelete = async () => {
    setBusy(true);
    try {
      if (tx.splitId) {
        // One payment: every part goes together, and comes back together.
        const snapshots = await deleteSplit(tx.splitId);
        haptics.warn();
        onChanged();
        showUndo('Split moved to Recently deleted', async () => {
          await restoreSplit(snapshots);
          onChanged();
        });
        return;
      }
      const snapshot = await deleteTransaction(tx.id);
      haptics.warn();
      onChanged();
      showUndo('Moved to Recently deleted', async () => {
        await restoreTransaction(snapshot);
        onChanged();
      });
    } catch (e) {
      Alert.alert("Couldn't delete", errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const confirmUndoLoan = (loanPaymentId: string) => {
    Alert.alert(
      'Undo this EMI payment',
      "The installment goes back to pending and the loan's outstanding balance is restored. You can then re-enter it correctly.",
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Undo payment',
          style: 'destructive',
          onPress: async () => {
            setBusy(true);
            try {
              await undoInstallmentPayment(loanPaymentId);
              onChanged();
            } catch (e) {
              Alert.alert("Couldn't undo", errorMessage(e));
            } finally {
              setBusy(false);
            }
          },
        },
      ]
    );
  };

  const confirmUndoPerson = () => {
    Alert.alert(
      'Undo this entry',
      'This removes both the transaction and the Friends & Family ledger entry it created.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Undo entry',
          style: 'destructive',
          onPress: async () => {
            setBusy(true);
            try {
              await undoPersonTransaction(tx.id);
              onChanged();
            } catch (e) {
              Alert.alert("Couldn't undo", errorMessage(e));
            } finally {
              setBusy(false);
            }
          },
        },
      ]
    );
  };

  // Every other detail popup in the app (account, loan) is this same bottom
  // sheet — a grabber + title, then a pinned footer — so this one no longer
  // stands alone as a small centered dialog with its own floating "Close"
  // button; swiping down or tapping the backdrop closes it like everywhere
  // else.
  const footer =
    link === null ? (
      <View style={f.footerRow}>
        <PrimaryButton
          title="Delete"
          variant="secondary"
          onPress={confirmDelete}
          disabled={busy}
          style={f.footerBtn}
        />
        <PrimaryButton title="Edit" onPress={() => onEdit(tx)} disabled={busy} style={f.footerBtn} />
      </View>
    ) : link !== undefined ? (
      <PrimaryButton title="Close" variant="secondary" onPress={onClose} disabled={busy} />
    ) : undefined;

  return (
    <ModalSheet visible onClose={onClose} title="Transaction" footer={footer}>
      <View style={styles.detailHeaderRow}>
        <CategoryIcon
          name={tx.type === 'transfer' ? 'swap-horizontal' : (cat?.icon ?? 'tag')}
          color={tx.type === 'transfer' ? theme.colors.secondary : (cat?.color ?? theme.colors.textMuted)}
          square={44}
          size={20}
        />
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={styles.detailTitle} numberOfLines={1}>
            {tx.type === 'transfer'
              ? `${accountName(tx.accountId)} → ${accountName(tx.toAccountId!)}`
              : (cat?.name ?? (tx.note || tx.type))}
          </Text>
          <Text style={styles.rowSub}>
            {tx.isRefund && <Text style={styles.rowRefund}>Refund · </Text>}
            {tx.date} · {accountName(tx.accountId)}
          </Text>
        </View>
      </View>
      <Text
        style={[
          styles.detailAmount,
          tx.type === 'income' && styles.income,
          tx.type === 'expense' && styles.expense,
        ]}
      >
        {tx.type === 'expense' ? '-' : tx.type === 'income' ? '+' : ''}
        <Amount minor={tx.amountMinor} sensitive={cat?.isSensitive} />
      </Text>
      {!!tx.note && <Text style={styles.detailNote}>{tx.note}</Text>}

      {tx.splitId && splitParts && splitParts.length > 0 && (
        <View style={styles.splitCard}>
          <Text style={styles.splitCardTitle}>
            Part of a {formatMoney(splitParts.reduce((s, p) => s + p.amountMinor, 0))} split
          </Text>
          {splitParts.map((p) => {
            const pc = categories.find((c) => c.id === p.categoryId);
            const mine = p.id === tx.id;
            return (
              <View key={p.id} style={styles.splitPart}>
                <Text style={[styles.splitPartName, mine && styles.splitPartMine]} numberOfLines={1}>
                  {pc?.name ?? 'Uncategorised'}
                </Text>
                <Amount
                  minor={p.amountMinor}
                  sensitive={pc?.isSensitive}
                  style={[styles.splitPartAmount, mine && styles.splitPartMine]}
                />
              </View>
            );
          })}
        </View>
      )}

      {cat && tx.type !== 'transfer' && (
        <Pressable
          onPress={() => {
            onClose();
            // Opened from that category's own page? Then closing is enough.
            returnOrPush({ name: 'category/[id]', params: { id: cat.id } }, `/category/${cat.id}`);
          }}
          style={withPressed(styles.detailLink)}
          accessibilityRole="button"
        >
          <Text style={styles.detailLinkText}>See everything in {cat.name}</Text>
          <Feather name="chevron-right" size={14} color={theme.colors.textSecondary} />
        </Pressable>
      )}

      {link === null && !tx.splitId && (
        <View style={styles.detailActions}>
          <PrimaryButton
            title="Log again today"
            variant="secondary"
            onPress={logAgainToday}
            disabled={busy}
            style={styles.detailAction}
          />
          <PrimaryButton
            title="Make it recurring"
            variant="secondary"
            onPress={() => setRuleOpen(true)}
            disabled={busy}
            style={styles.detailAction}
          />
        </View>
      )}
      {link === null && tx.type === 'expense' && cat && (
        <PrimaryButton
          title="Got money back"
          variant="secondary"
          onPress={() => {
            onClose();
            // A refund for this purchase: its category, account and note, filled in on Add.
            router.push(
              `/add-transaction?type=expense&refund=1&categoryId=${cat.id}&accountId=${tx.accountId}` +
                (tx.note ? `&note=${encodeURIComponent(tx.note)}` : '')
            );
          }}
          disabled={busy}
          style={styles.detailActionWide}
        />
      )}

      {link === undefined ? (
        <Text style={styles.hintText}>Checking…</Text>
      ) : link === null ? null : link.kind === 'loan' ? (
        <>
          <Text style={styles.hintText}>This is a loan EMI payment — it can't be edited directly.</Text>
          <PrimaryButton
            title={busy ? 'Undoing…' : 'Undo payment'}
            variant="secondary"
            onPress={() => confirmUndoLoan(link.loanPaymentId)}
            disabled={busy}
          />
        </>
      ) : link.kind === 'person' ? (
        <>
          <Text style={styles.hintText}>This is a Friends & Family entry — it can't be edited directly.</Text>
          <PrimaryButton
            title={busy ? 'Undoing…' : 'Undo entry'}
            variant="secondary"
            onPress={confirmUndoPerson}
            disabled={busy}
          />
        </>
      ) : (
        <Text style={styles.hintText}>
          This is a loan disbursement or prepayment — editing isn't supported yet.
        </Text>
      )}
      <RuleModal
        visible={ruleOpen}
        editing={null}
        accounts={accounts}
        categories={categories}
        prefill={rulePrefill}
        onClose={() => setRuleOpen(false)}
        onSaved={() => {
          setRuleOpen(false);
          haptics.confirm();
        }}
        onDeleted={() => setRuleOpen(false)}
      />
    </ModalSheet>
  );
}
