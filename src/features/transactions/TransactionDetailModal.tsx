import { useEffect, useState } from 'react';
import { View, Text, Alert } from 'react-native';
import { deleteTransaction, getTransactionLink, TransactionLink } from '@/db/ledger';
import { undoInstallmentPayment } from '@/db/loans';
import { undoPersonTransaction } from '@/db/people';
import { Account, Category, Transaction } from '@/types';
import { PrimaryButton } from '@/components/PrimaryButton';
import { CategoryIcon } from '@/components/CategoryIcon';
import { Amount } from '@/components/Amount';
import { ModalSheet } from '@/components/ModalSheet';
import { theme } from '@/constants/theme';
import { styles } from './transactions.styles';

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
  const [link, setLink] = useState<TransactionLink | undefined>(undefined);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!tx) {
      setLink(undefined);
      return;
    }
    setLink(undefined);
    getTransactionLink(tx.id).then(setLink);
  }, [tx]);

  if (!tx) return null;

  const cat = categories.find((c) => c.id === tx.categoryId);
  const accountName = (id: string) => accounts.find((a) => a.id === id)?.name ?? '—';

  const confirmDelete = () => {
    Alert.alert('Delete transaction', 'This removes it permanently — account balances update immediately.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setBusy(true);
          try {
            await deleteTransaction(tx.id);
            onChanged();
          } catch (e: any) {
            Alert.alert('Could not delete', String(e?.message ?? e));
          } finally {
            setBusy(false);
          }
        },
      },
    ]);
  };

  const confirmUndoLoan = (loanPaymentId: string) => {
    Alert.alert(
      'Undo this EMI payment',
      "The installment goes back to pending and the loan's outstanding balance is restored. You can then re-enter it correctly.",
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Undo Payment',
          style: 'destructive',
          onPress: async () => {
            setBusy(true);
            try {
              await undoInstallmentPayment(loanPaymentId);
              onChanged();
            } catch (e: any) {
              Alert.alert('Could not undo', String(e?.message ?? e));
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
          text: 'Undo Entry',
          style: 'destructive',
          onPress: async () => {
            setBusy(true);
            try {
              await undoPersonTransaction(tx.id);
              onChanged();
            } catch (e: any) {
              Alert.alert('Could not undo', String(e?.message ?? e));
            } finally {
              setBusy(false);
            }
          },
        },
      ]
    );
  };

  return (
    <ModalSheet visible onClose={onClose} variant="center" scrollable={false}>
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

      {link === undefined ? (
        <Text style={styles.hintText}>Checking...</Text>
      ) : link === null ? (
        <View style={styles.modalActions}>
          <PrimaryButton
            title="Edit"
            onPress={() => onEdit(tx)}
            disabled={busy}
            style={{ flex: 1, marginRight: 8 }}
          />
          <PrimaryButton
            title="Delete"
            variant="secondary"
            onPress={confirmDelete}
            disabled={busy}
            style={{ flex: 1 }}
          />
        </View>
      ) : link.kind === 'loan' ? (
        <>
          <Text style={styles.hintText}>This is a loan EMI payment — it can't be edited directly.</Text>
          <PrimaryButton
            title={busy ? 'Undoing...' : 'Undo Payment'}
            variant="secondary"
            onPress={() => confirmUndoLoan(link.loanPaymentId)}
            disabled={busy}
          />
        </>
      ) : link.kind === 'person' ? (
        <>
          <Text style={styles.hintText}>This is a Friends & Family entry — it can't be edited directly.</Text>
          <PrimaryButton
            title={busy ? 'Undoing...' : 'Undo Entry'}
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

      <PrimaryButton
        title="Close"
        variant="secondary"
        onPress={onClose}
        style={{ marginTop: 10 }}
        disabled={busy}
      />
    </ModalSheet>
  );
}
