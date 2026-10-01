import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Text } from '@/components/Text';
import {
  updateAccount,
  archiveAccount,
  unarchiveAccount,
  deleteAccount,
  restoreAccount,
  getAccountTransactionCount,
} from '@/db/ledger';
import { toMinor, formatMoney, formatMaskableMoney } from '@/lib/money';
import { usePrivacy } from '@/theme/PrivacyContext';
import { Account, AccountType } from '@/types';
import { ModalSheet, SheetLink } from '@/components/ModalSheet';
import { SheetCard } from '@/components/SheetCard';
import { modalFooterStyles as f } from '@/constants/theme';
import { useAccent } from '@/theme/AccentContext';
import { accountIcon } from '@/lib/account';
import { accountHue } from '@/features/home/AccountChip';
import { FormInput } from '@/components/FormInput';
import { PrimaryButton } from '@/components/PrimaryButton';
import { Chip } from '@/components/Chip';
import { useUndoToast } from '@/components/UndoToast';
import { haptics } from '@/lib/haptics';
import { styles } from './profile.styles';
import { ACCOUNT_TYPES } from './profile.constants';
import { errorMessage } from '@/lib/errorMessage';
import { CardCycleFields } from './CardCycleFields';
import { parseCycleDays } from '@/lib/cardCycle';
import { showAlert } from '@/components/AppDialog';

/**
 * Editing/archiving/deleting an account, opened by tapping any account card.
 * Name/type/opening balance/credit limit are freely editable (currency is
 * deliberately not — see `updateAccount`'s own comment). The quiet link at
 * the end is chosen based on real usage rather than offered as two competing
 * actions: an account with any transaction history can only be Archived
 * (hides it, keeps every past number intact); a completely unused one
 * (created by mistake, or freshly archived and never touched) can be
 * properly Deleted.
 */
export function AccountDetailModal({
  account,
  onClose,
  onChanged,
}: {
  account: Account | null;
  onClose: () => void;
  onChanged: () => void;
}) {
  const { show: showUndo } = useUndoToast();
  const { accent } = useAccent();
  const { hideAmounts } = usePrivacy();
  const hideSavings = hideAmounts && account?.type === 'savings';
  const [name, setName] = useState('');
  const [type, setType] = useState<AccountType>('bank');
  const [opening, setOpening] = useState('0');
  const [creditLimit, setCreditLimit] = useState('');
  const [statementDay, setStatementDay] = useState('');
  const [dueDay, setDueDay] = useState('');
  const [txCount, setTxCount] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!account) return;
    setName(account.name);
    setType(account.type);
    setOpening((account.openingBalanceMinor / 100).toString());
    setCreditLimit(account.creditLimitMinor != null ? (account.creditLimitMinor / 100).toString() : '');
    setStatementDay(account.statementDay != null ? String(account.statementDay) : '');
    setDueDay(account.dueDay != null ? String(account.dueDay) : '');
    setError(null);
    setTxCount(null);
    // Leaves txCount at null on failure — same as before this fix, which
    // only removes the unhandled rejection. A stuck "Checking usage..."
    // state on a real DB error is a pre-existing, separate UX gap (it
    // permanently blocks the delete/archive decision below), not
    // introduced here.
    getAccountTransactionCount(account.id)
      .then(setTxCount)
      .catch(() => {});
  }, [account]);

  if (!account) return null;

  const submit = async () => {
    setError(null);
    if (!name.trim()) {
      setError('Enter a name');
      return;
    }
    const openingBalanceMinor = toMinor(parseFloat(opening || '0'));
    const creditLimitMinor = type === 'credit_card' && creditLimit ? toMinor(parseFloat(creditLimit)) : null;
    if (
      !Number.isFinite(openingBalanceMinor) ||
      (creditLimitMinor !== null && !Number.isFinite(creditLimitMinor))
    ) {
      setError('Enter a valid opening balance and credit limit');
      return;
    }
    const days =
      type === 'credit_card' ? parseCycleDays(statementDay, dueDay) : { statementDay: null, dueDay: null };
    if ('error' in days) {
      setError(days.error);
      return;
    }
    setSaving(true);
    try {
      await updateAccount(account.id, {
        name: name.trim(),
        type,
        openingBalanceMinor,
        creditLimitMinor,
        statementDay: days.statementDay,
        dueDay: days.dueDay,
      });
      onChanged();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const confirmArchive = () => {
    showAlert(
      'Archive this account?',
      'It disappears from account pickers and totals, but every past transaction against it stays exactly as it is. You can unarchive it later.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Archive',
          style: 'destructive',
          onPress: async () => {
            setBusy(true);
            try {
              await archiveAccount(account.id);
              onChanged();
            } catch (e) {
              showAlert("Couldn't archive", errorMessage(e));
            } finally {
              setBusy(false);
            }
          },
        },
      ]
    );
  };

  const onUnarchive = async () => {
    setBusy(true);
    try {
      await unarchiveAccount(account.id);
      onChanged();
    } catch (e) {
      showAlert("Couldn't unarchive", errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const confirmDelete = async () => {
    setBusy(true);
    try {
      const snapshot = await deleteAccount(account.id);
      haptics.warn();
      onChanged();
      showUndo(`Deleted "${account.name}"`, async () => {
        await restoreAccount(snapshot);
        onChanged();
      });
    } catch (e) {
      showAlert("Couldn't delete", errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  // The calm-sheets sign-off (Direction C): the account's own card, which
  // retints as you change its type, then the form. Archive or delete is a
  // quiet link at the end, not a second button beside Save.
  return (
    <ModalSheet
      visible
      onClose={onClose}
      footer={
        <View style={f.footerCol}>
          {error && <Text style={styles.errorText}>{error}</Text>}
          <PrimaryButton
            title={saving ? 'Saving…' : 'Save changes'}
            onPress={submit}
            disabled={saving || busy}
          />
        </View>
      }
    >
      <SheetCard
        hue={accountHue(type, accent)}
        icon={accountIcon(type)}
        kicker={ACCOUNT_TYPES.find((t) => t.value === type)?.label}
        amount={formatMaskableMoney(account.currentBalanceMinor, {
          currency: account.currency,
          masked: hideSavings,
        })}
        title={name.trim() || account.name}
        meta={
          hideSavings
            ? 'Balance now'
            : `Balance now · opened with ${formatMoney(toMinor(parseFloat(opening || '0')) || 0, account.currency)}`
        }
      />
      <FormInput label="Name" value={name} onChangeText={setName} placeholder="e.g. HDFC Savings" />
      <Text style={styles.fieldLabel}>Type</Text>
      <View style={styles.chipRow}>
        {ACCOUNT_TYPES.map((t) => (
          <Chip key={t.value} label={t.label} active={type === t.value} onPress={() => setType(t.value)} />
        ))}
      </View>
      <FormInput
        label="Opening balance"
        value={opening}
        onChangeText={setOpening}
        keyboardType="numeric"
        placeholder="0"
      />
      {type === 'credit_card' && (
        <>
          <FormInput
            label="Credit limit"
            value={creditLimit}
            onChangeText={setCreditLimit}
            keyboardType="numeric"
            placeholder="e.g. 100000"
          />
          <CardCycleFields
            statementDay={statementDay}
            dueDay={dueDay}
            onChangeStatementDay={setStatementDay}
            onChangeDueDay={setDueDay}
          />
        </>
      )}
      {account.archived ? (
        <SheetLink
          label={busy ? 'Working…' : 'Unarchive account'}
          onPress={onUnarchive}
          disabled={busy}
          danger={false}
        />
      ) : txCount === null ? (
        <Text style={styles.hintText}>Checking usage…</Text>
      ) : txCount > 0 ? (
        <SheetLink
          label={busy ? 'Working…' : `Archive account · ${txCount} ${txCount === 1 ? 'entry' : 'entries'}`}
          onPress={confirmArchive}
          disabled={busy}
        />
      ) : (
        <SheetLink label={busy ? 'Working…' : 'Delete account'} onPress={confirmDelete} disabled={busy} />
      )}
    </ModalSheet>
  );
}
