import { useEffect, useState } from 'react';
import { View, Text, Alert } from 'react-native';
import {
  updateAccount,
  archiveAccount,
  unarchiveAccount,
  deleteAccount,
  getAccountTransactionCount,
} from '@/db/ledger';
import { toMinor } from '@/lib/money';
import { Account, AccountType } from '@/types';
import { ModalSheet } from '@/components/ModalSheet';
import { FormInput } from '@/components/FormInput';
import { PrimaryButton } from '@/components/PrimaryButton';
import { Chip } from '@/components/Chip';
import { styles } from './profile.styles';
import { ACCOUNT_TYPES } from './profile.constants';

/**
 * Editing/archiving/deleting an account, opened by tapping any account card.
 * Name/type/opening balance/credit limit are freely editable (currency is
 * deliberately not — see `updateAccount`'s own comment). The danger-zone
 * action is chosen based on real usage rather than offered as two competing
 * buttons: an account with any transaction history can only be Archived
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
  const [name, setName] = useState('');
  const [type, setType] = useState<AccountType>('bank');
  const [opening, setOpening] = useState('0');
  const [creditLimit, setCreditLimit] = useState('');
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
    setError(null);
    setTxCount(null);
    getAccountTransactionCount(account.id).then(setTxCount);
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
    setSaving(true);
    try {
      await updateAccount(account.id, { name: name.trim(), type, openingBalanceMinor, creditLimitMinor });
      onChanged();
    } catch (e: any) {
      setError(String(e?.message ?? e));
    } finally {
      setSaving(false);
    }
  };

  const confirmArchive = () => {
    Alert.alert(
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
            } catch (e: any) {
              Alert.alert('Could not archive', String(e?.message ?? e));
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
    } catch (e: any) {
      Alert.alert('Could not unarchive', String(e?.message ?? e));
    } finally {
      setBusy(false);
    }
  };

  const confirmDelete = () => {
    Alert.alert(
      'Delete this account?',
      "This account has never been used, so this can't be undone but nothing else is affected.",
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setBusy(true);
            try {
              await deleteAccount(account.id);
              onChanged();
            } catch (e: any) {
              Alert.alert('Could not delete', String(e?.message ?? e));
            } finally {
              setBusy(false);
            }
          },
        },
      ]
    );
  };

  return (
    <ModalSheet visible onClose={onClose} title="Edit Account">
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
        <FormInput
          label="Credit limit"
          value={creditLimit}
          onChangeText={setCreditLimit}
          keyboardType="numeric"
          placeholder="e.g. 100000"
        />
      )}
      {error && <Text style={styles.errorText}>{error}</Text>}
      <View style={styles.modalActions}>
        <PrimaryButton
          title="Cancel"
          variant="secondary"
          onPress={onClose}
          style={{ flex: 1, marginRight: 8 }}
          disabled={saving || busy}
        />
        <PrimaryButton
          title={saving ? 'Saving...' : 'Save'}
          onPress={submit}
          disabled={saving || busy}
          style={{ flex: 1 }}
        />
      </View>

      <Text style={styles.dangerLabel}>DANGER ZONE</Text>
      {account.archived ? (
        <PrimaryButton
          title={busy ? 'Working...' : 'Unarchive account'}
          variant="secondary"
          onPress={onUnarchive}
          disabled={busy}
        />
      ) : txCount === null ? (
        <Text style={styles.hintText}>Checking usage...</Text>
      ) : txCount > 0 ? (
        <PrimaryButton
          title={busy ? 'Working...' : `Archive account (${txCount} transaction${txCount === 1 ? '' : 's'})`}
          variant="secondary"
          onPress={confirmArchive}
          disabled={busy}
          style={styles.deleteButton}
        />
      ) : (
        <PrimaryButton
          title={busy ? 'Working...' : 'Delete account'}
          variant="secondary"
          onPress={confirmDelete}
          disabled={busy}
          style={styles.deleteButton}
        />
      )}
    </ModalSheet>
  );
}
