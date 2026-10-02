import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Text } from '@/components/Text';
import { createAccount } from '@/db/ledger';
import { getDefaultCurrency, SUPPORTED_CURRENCIES } from '@/db/settings';
import { toMinor, formatMoney } from '@/lib/money';
import { AccountType } from '@/types';
import { ModalSheet } from '@/components/ModalSheet';
import { SheetCard } from '@/components/SheetCard';
import { useAccent } from '@/theme/AccentContext';
import { accountHue, accountIcon } from '@/lib/account';
import { modalFooterStyles as f } from '@/constants/theme';
import { FormInput } from '@/components/FormInput';
import { AmountField } from '@/components/AmountField';
import { PrimaryButton } from '@/components/PrimaryButton';
import { Chip } from '@/components/Chip';
import { ToggleSwitch } from '@/components/ToggleSwitch';
import { addValuation } from '@/db/valuations';
import { toLocalIsoDate } from '@/lib/date';
import { styles } from './profile.styles';
import { ACCOUNT_TYPES } from './profile.constants';
import { errorMessage } from '@/lib/errorMessage';
import { CardCycleFields } from './CardCycleFields';
import { parseCycleDays } from '@/lib/cardCycle';

export function AddAccountModal({
  visible,
  onClose,
  onCreated,
}: {
  visible: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const { accent } = useAccent();
  const [name, setName] = useState('');
  const [type, setType] = useState<AccountType>('bank');
  const [opening, setOpening] = useState('0');
  const [creditLimit, setCreditLimit] = useState('');
  const [statementDay, setStatementDay] = useState('');
  const [dueDay, setDueDay] = useState('');
  const [tracked, setTracked] = useState(false);
  const [worth, setWorth] = useState('');
  const [currency, setCurrency] = useState('INR');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Defaults to the app's default currency each time the modal opens, but
  // stays changeable — an account for money that genuinely isn't in your
  // usual currency (a foreign bank account, a USD wallet) needs its own
  // currency set at creation, since it can never be changed afterward once
  // real transactions exist against it.
  useEffect(() => {
    if (visible)
      getDefaultCurrency()
        .then(setCurrency)
        .catch(() => {});
  }, [visible]);

  const reset = () => {
    setName('');
    setType('bank');
    setOpening('0');
    setCreditLimit('');
    setStatementDay('');
    setDueDay('');
    setTracked(false);
    setWorth('');
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
    const days =
      type === 'credit_card' ? parseCycleDays(statementDay, dueDay) : { statementDay: null, dueDay: null };
    if ('error' in days) {
      setError(days.error);
      return;
    }
    const tracking = type === 'savings' && tracked;
    const worthMinor = tracking && worth.trim() ? toMinor(parseFloat(worth)) : null;
    if (worthMinor !== null && (!Number.isFinite(worthMinor) || worthMinor < 0)) {
      setError('Enter what it is worth today');
      return;
    }
    setSaving(true);
    try {
      const created = await createAccount({
        name: name.trim(),
        type,
        currency,
        openingBalanceMinor,
        creditLimitMinor,
        statementDay: days.statementDay,
        dueDay: days.dueDay,
        tracked: tracking,
      });
      if (worthMinor !== null) {
        await addValuation(created.id, { date: toLocalIsoDate(new Date()), valueMinor: worthMinor });
      }
      reset();
      onCreated();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const trackingNow = type === 'savings' && tracked;

  // The calm-sheets sign-off (Direction C): the new account's card, tinted
  // by the type you pick, with its opening balance.
  return (
    <ModalSheet
      visible={visible}
      onClose={onClose}
      footer={
        <View style={f.footerCol}>
          {error && <Text style={styles.errorText}>{error}</Text>}
          <PrimaryButton title={saving ? 'Saving…' : 'Create account'} onPress={submit} disabled={saving} />
        </View>
      }
    >
      <SheetCard
        hue={accountHue(type, accent)}
        icon={accountIcon(type)}
        kicker={ACCOUNT_TYPES.find((t) => t.value === type)?.label}
        amount={formatMoney(
          toMinor(parseFloat((trackingNow && worth.trim() ? worth : opening) || '0')) || 0,
          currency
        )}
        title={name.trim() || 'New account'}
        meta={trackingNow ? (worth.trim() ? 'Worth today' : 'Invested so far') : 'Opening balance'}
      />
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
      {type === 'savings' && (
        <>
          <View style={styles.toggleRow}>
            <Text style={styles.fieldLabel}>Track its value</Text>
            <ToggleSwitch value={tracked} onChange={setTracked} />
          </View>
          <Text style={styles.hintText}>
            For an index fund, stocks or gold: you update what it's worth now and then, and Yume shows the
            gain.
          </Text>
        </>
      )}
      <AmountField
        label={trackingNow ? 'Invested so far' : 'Opening balance'}
        value={opening}
        onChangeText={setOpening}
        placeholder="0"
      />
      {trackingNow && (
        <AmountField
          label="Worth today (optional)"
          value={worth}
          onChangeText={setWorth}
          placeholder="Leave empty to add it later"
        />
      )}
      {type === 'credit_card' && (
        <>
          <AmountField
            label="Credit limit"
            value={creditLimit}
            onChangeText={setCreditLimit}
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
    </ModalSheet>
  );
}
