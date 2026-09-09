import { useEffect, useState } from 'react';
import { View, Text } from 'react-native';
import { createAccount } from '@/db/ledger';
import { getDefaultCurrency, SUPPORTED_CURRENCIES } from '@/db/settings';
import { toMinor } from '@/lib/money';
import { AccountType } from '@/types';
import { ModalSheet } from '@/components/ModalSheet';
import { FormInput } from '@/components/FormInput';
import { PrimaryButton } from '@/components/PrimaryButton';
import { Chip } from '@/components/Chip';
import { styles } from './profile.styles';
import { ACCOUNT_TYPES } from './profile.constants';

export function AddAccountModal({
  visible,
  onClose,
  onCreated,
}: {
  visible: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState('');
  const [type, setType] = useState<AccountType>('bank');
  const [opening, setOpening] = useState('0');
  const [creditLimit, setCreditLimit] = useState('');
  const [currency, setCurrency] = useState('INR');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Defaults to the app's default currency each time the modal opens, but
  // stays changeable — an account for money that genuinely isn't in your
  // usual currency (a foreign bank account, a USD wallet) needs its own
  // currency set at creation, since it can never be changed afterward once
  // real transactions exist against it.
  useEffect(() => {
    if (visible) getDefaultCurrency().then(setCurrency);
  }, [visible]);

  const reset = () => {
    setName('');
    setType('bank');
    setOpening('0');
    setCreditLimit('');
  };

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
      await createAccount({ name: name.trim(), type, currency, openingBalanceMinor, creditLimitMinor });
      reset();
      onCreated();
    } catch (e: any) {
      setError(String(e?.message ?? e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalSheet visible={visible} onClose={onClose} title="New Account">
      <FormInput label="Name" value={name} onChangeText={setName} placeholder="e.g. HDFC Savings" />
      <Text style={styles.fieldLabel}>Type</Text>
      <View style={styles.chipRow}>
        {ACCOUNT_TYPES.map((t) => (
          <Chip key={t.value} label={t.label} active={type === t.value} onPress={() => setType(t.value)} />
        ))}
      </View>
      {type === 'savings' && (
        <Text style={styles.hintText}>
          Use this for a savings pot, SIP, or PF — move money in with a transfer, and any withdrawal is just a
          transfer back out.
        </Text>
      )}
      <Text style={styles.fieldLabel}>Currency</Text>
      <View style={styles.chipRow}>
        {SUPPORTED_CURRENCIES.map((c) => (
          <Chip
            key={c.code}
            label={c.code}
            active={currency === c.code}
            onPress={() => setCurrency(c.code)}
          />
        ))}
      </View>
      <Text style={styles.hintText}>Can't be changed once this account has any transactions.</Text>
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
        />
        <PrimaryButton
          title={saving ? 'Saving...' : 'Create'}
          onPress={submit}
          disabled={saving}
          style={{ flex: 1 }}
        />
      </View>
    </ModalSheet>
  );
}
