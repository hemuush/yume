import { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
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
import { Amount } from '@/components/Amount';
import { ModalSheet, SheetFooter } from '@/components/ModalSheet';
import { SheetCard } from '@/components/SheetCard';
import { SettingsRow } from '@/components/SettingsRow';
import { SegmentedControl } from '@/components/SegmentedControl';
import { theme, modalFooterStyles as f } from '@/constants/theme';
import { screenStyles as h } from '@/components/screenStyles';
import { accountIcon } from '@/lib/account';
import { hexToRgba } from '@/lib/color';
import { categorySentence, inParent, joinSub, parentNameOf } from '@/lib/categoryLabel';
import { weekdayDayMonth } from '@/lib/dateLabels';
import { useUndoToast } from '@/components/UndoToast';
import { haptics } from '@/lib/haptics';
import { emitTransactionsChanged } from '@/lib/dataEvents';
import { toLocalIsoDate, nextMonthlyDateAfter } from '@/lib/date';
import { RuleModal } from '@/features/recurring/RuleModal';
import { styles } from './transactions.styles';
import { errorMessage } from '@/lib/errorMessage';
import { useReturnOrPush } from '@/lib/useReturnOrPush';
import { getSplitParts, deleteSplit, restoreSplit } from '@/db/splits';
import { formatMaskableMoney } from '@/lib/money';
import { usePrivacy } from '@/theme/PrivacyContext';
import { router } from 'expo-router';
import { showAlert } from '@/components/AppDialog';

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
  const { hideAmounts } = usePrivacy();
  const { show: showUndo } = useUndoToast();
  const [link, setLink] = useState<TransactionLink | undefined>(undefined);
  // The link lookup failed: stop saying "Checking…" and treat the entry as plain, so Edit stays usable.
  const [linkFailed, setLinkFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [ruleOpen, setRuleOpen] = useState(false);
  const [tab, setTab] = useState<'details' | 'more'>('details');

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
    setTab('details');
    setLinkFailed(false);
    setLink(undefined);
    if (!tx) return;
    let alive = true;
    getTransactionLink(tx.id)
      .then((l) => {
        if (alive) setLink(l);
      })
      .catch(() => {
        if (!alive) return;
        setLinkFailed(true);
        setLink(null);
      });
    return () => {
      alive = false;
    };
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
  const categoriesById = new Map(categories.map((c) => [c.id, c]));
  const parentName = parentNameOf(tx.categoryId, categoriesById);
  const account = accounts.find((a) => a.id === tx.accountId);
  const accountName = (id: string) => accounts.find((a) => a.id === id)?.name ?? '—';
  const transfer = tx.type === 'transfer';
  const movesSavings =
    transfer &&
    [tx.accountId, tx.toAccountId].some((id) => accounts.find((a) => a.id === id)?.type === 'savings');

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
        // A refund logged again is still a refund, not ordinary income.
        isRefund: tx.isRefund,
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
      showAlert("Couldn't log it", errorMessage(e));
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
      showAlert("Couldn't delete", errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const confirmUndoLoan = (loanPaymentId: string) => {
    showAlert(
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
              showAlert("Couldn't undo", errorMessage(e));
            } finally {
              setBusy(false);
            }
          },
        },
      ]
    );
  };

  const confirmUndoPerson = () => {
    showAlert(
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
              showAlert("Couldn't undo", errorMessage(e));
            } finally {
              setBusy(false);
            }
          },
        },
      ]
    );
  };

  // The entry as a card in its category's colour, then two pages (what it is, what you can do) so neither
  // scrolls. Delete is the bin beside Edit.
  const canEdit = link === null;
  const moreActions = [
    canEdit &&
      !tx.splitId && {
        icon: 'plus',
        bg: theme.colors.primaryTint,
        label: 'Log again today',
        sub: 'Same amount, account and note',
        onPress: logAgainToday,
      },
    canEdit &&
      !tx.splitId && {
        icon: 'repeat',
        bg: theme.colors.idTeal,
        label: 'Make it recurring',
        sub: 'Yume logs it for you on a schedule',
        onPress: () => setRuleOpen(true),
      },
    canEdit &&
      tx.type === 'expense' &&
      cat && {
        icon: 'cash-refund',
        bg: theme.colors.idSage,
        label: 'Got money back',
        sub: 'Add a refund for this',
        onPress: () => {
          onClose();
          // A refund for this purchase: its category, account and note, filled in on Add.
          router.push(
            `/add-transaction?type=expense&refund=1&categoryId=${cat.id}&accountId=${tx.accountId}` +
              (tx.note ? `&note=${encodeURIComponent(tx.note)}` : '')
          );
        },
      },
  ].filter((a) => !!a);
  const kind = transfer ? 'Transfer' : tx.isRefund ? 'Refund' : tx.type === 'income' ? 'Income' : 'Expense';
  const route = transfer ? `${accountName(tx.accountId)} → ${accountName(tx.toAccountId!)}` : null;

  return (
    <ModalSheet
      visible
      onClose={onClose}
      footer={
        canEdit ? (
          <SheetFooter onDelete={confirmDelete} deleteLabel="Delete entry" disabled={busy}>
            <PrimaryButton title="Edit" onPress={() => onEdit(tx)} disabled={busy} style={f.footerBtn} />
          </SheetFooter>
        ) : link?.kind === 'loan' ? (
          <PrimaryButton
            title={busy ? 'Undoing…' : 'Undo payment'}
            variant="secondary"
            onPress={() => confirmUndoLoan(link.loanPaymentId)}
            disabled={busy}
          />
        ) : link?.kind === 'person' ? (
          <PrimaryButton
            title={busy ? 'Undoing…' : 'Undo entry'}
            variant="secondary"
            onPress={confirmUndoPerson}
            disabled={busy}
          />
        ) : undefined
      }
    >
      <SheetCard
        hue={transfer ? theme.colors.secondary : (cat?.color ?? theme.colors.textMuted)}
        icon={transfer ? 'swap-horizontal' : (cat?.icon ?? 'tag')}
        kicker={transfer || !parentName ? kind : `${kind} · ${parentName}`}
        amount={
          <>
            {tx.type === 'expense' ? '−' : tx.type === 'income' ? '+' : ''}
            <Amount minor={tx.amountMinor} sensitive={cat?.isSensitive || movesSavings} />
          </>
        }
        amountColor={
          tx.type === 'expense'
            ? theme.colors.expenseText
            : tx.type === 'income'
              ? theme.colors.incomeText
              : theme.colors.textPrimary
        }
        title={route ?? cat?.name ?? kind}
        meta={route ? weekdayDayMonth(tx.date) : `${weekdayDayMonth(tx.date)} · ${accountName(tx.accountId)}`}
      />

      {moreActions.length > 0 && (
        <View style={styles.detailTabs}>
          <SegmentedControl
            options={[
              { label: 'Details', value: 'details' },
              { label: 'Actions', value: 'more' },
            ]}
            value={tab}
            onChange={setTab}
          />
        </View>
      )}

      {tab === 'more' && moreActions.length > 0 ? (
        <View style={[h.card, h.cardInSheet]}>
          {moreActions.map((a, i) => (
            <SettingsRow
              key={a.label}
              round
              icon={a.icon}
              iconBg={a.bg}
              label={a.label}
              sub={a.sub}
              onPress={busy ? undefined : a.onPress}
              divider={i > 0}
            />
          ))}
        </View>
      ) : (
        <>
          <View style={[h.card, h.cardInSheet]}>
            {cat && !transfer && (
              <SettingsRow
                round
                icon={cat.icon}
                iconBg={hexToRgba(cat.color, 0.25)}
                label={cat.name}
                sub={joinSub([inParent(parentName), 'See everything in it'])}
                onPress={() => {
                  onClose();
                  // Opened from that category's own page? Then closing is enough.
                  returnOrPush({ name: 'category/[id]', params: { id: cat.id } }, `/category/${cat.id}`);
                }}
              />
            )}
            <SettingsRow
              round
              icon={transfer ? 'swap-horizontal' : account ? accountIcon(account.type) : 'bank'}
              iconBg={theme.colors.primaryTint}
              label={route ?? accountName(tx.accountId)}
              sub={
                transfer ? 'Moved between your accounts' : tx.type === 'income' ? 'Received in' : 'Paid from'
              }
              divider={!!cat && !transfer}
            />
            {!!tx.note && (
              <SettingsRow
                round
                icon="note-text-outline"
                iconBg={theme.colors.idGold}
                label="Note"
                sub={tx.note}
                divider
              />
            )}
          </View>

          {tx.splitId && splitParts && splitParts.length > 0 && (
            <View style={styles.splitCard}>
              <Text style={styles.splitCardTitle}>
                Part of a{' '}
                {formatMaskableMoney(
                  splitParts.reduce((s, p) => s + p.amountMinor, 0),
                  {
                    masked:
                      hideAmounts &&
                      splitParts.some((p) => categories.find((c) => c.id === p.categoryId)?.isSensitive),
                  }
                )}{' '}
                split
              </Text>
              {splitParts.map((p) => {
                const pc = categories.find((c) => c.id === p.categoryId);
                const mine = p.id === tx.id;
                return (
                  <View key={p.id} style={styles.splitPart}>
                    <Text style={[styles.splitPartName, mine && styles.splitPartMine]} numberOfLines={1}>
                      {pc
                        ? categorySentence(pc.name, parentNameOf(p.categoryId, categoriesById))
                        : 'Uncategorised'}
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

          {link === undefined ? (
            <Text style={styles.hintText}>Checking…</Text>
          ) : link === null ? (
            linkFailed ? (
              <Text style={styles.hintText}>
                Couldn't check whether this entry is tied to a loan or a person. You can still edit it.
              </Text>
            ) : null
          ) : link.kind === 'loan' ? (
            <Text style={styles.hintText}>
              A loan EMI payment — it can't be edited directly. Undo it to put the installment back to
              pending.
            </Text>
          ) : link.kind === 'person' ? (
            <Text style={styles.hintText}>
              A Friends & Family entry — it can't be edited directly. Undo it to remove it from their balance
              too.
            </Text>
          ) : (
            <Text style={styles.hintText}>
              This is a loan disbursement or prepayment — editing isn't supported yet.
            </Text>
          )}
        </>
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
