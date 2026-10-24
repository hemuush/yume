import { useSaveOnce } from '@/lib/useSaveOnce';
import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { Text } from '@/components/Text';
import { createAccount, listAccounts } from '@/db/ledger';
import { getCachedCurrency, getDefaultCurrency, SUPPORTED_CURRENCIES } from '@/db/settings';
import { toMinor } from '@/lib/money';
import type { Account, InvestmentKind } from '@/types';
import { ModalSheet } from '@/components/ModalSheet';
import { DraftCard } from '@/components/DraftCard';
import { useAccent } from '@/theme/AccentContext';
import { accountHue, accountIcon } from '@/lib/account';
import { modalFooterStyles as f } from '@/constants/theme';
import { FormInput } from '@/components/FormInput';
import { AmountField } from '@/components/AmountField';
import { PrimaryButton } from '@/components/PrimaryButton';
import { Chip } from '@/components/Chip';
import { addValuation } from '@/db/valuations';
import { toLocalIsoDate } from '@/lib/date';
import { styles } from './profile.styles';
import { ACCOUNT_CHOICES, typeOfChoice, type AccountChoice } from './profile.constants';
import { InvestmentFields, fundingChoices } from './InvestmentFields';
import { errorMessage } from '@/lib/errorMessage';
import { CardCycleFields } from './CardCycleFields';
import { parseCycleDays } from '@/lib/cardCycle';

export function AddAccountModal({
  visible,
  onClose,
  onCreated,
  initialChoice = 'bank',
}: {
  visible: boolean;
  onClose: () => void;
  onCreated: () => void;
  /** The type the form opens on (the Investments page opens it on Investment). */
  initialChoice?: AccountChoice;
}) {
  const { accent } = useAccent();
  const runAction = useSaveOnce(async (action: () => Promise<void>) => {
    await action();
  });
  const [name, setName] = useState('');
  const [choice, setChoice] = useState<AccountChoice>(initialChoice);
  const type = typeOfChoice(choice);
  const tracked = choice === 'investment';
  const [kind, setKind] = useState<InvestmentKind | null>(null);
  const [fundingId, setFundingId] = useState<string | null>(null);
  const [existing, setExisting] = useState<Account[]>([]);
  const [opening, setOpening] = useState('0');
  const [creditLimit, setCreditLimit] = useState('');
  const [statementDay, setStatementDay] = useState('');
  const [dueDay, setDueDay] = useState('');
  const [worth, setWorth] = useState('');
  const [currency, setCurrency] = useState(getCachedCurrency);
  const currencyChosen = useRef(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Set once createAccount succeeds so a retry after a failed valuation only retries the valuation rather
  // than creating a duplicate account.
  const createdId = useRef<string | null>(null);

  // Defaults to the app currency each time the modal opens but stays changeable: a foreign account needs its
  // own currency at creation, since it can't be changed once transactions exist.
  useEffect(() => {
    if (!visible) return;
    let live = true;
    currencyChosen.current = false;
    setChoice(initialChoice);
    getDefaultCurrency()
      .then((value) => {
        if (live && !currencyChosen.current) setCurrency(value);
      })
      .catch(() => {});
    // The accounts an investment's money could come from.
    listAccounts()
      .then((list) => {
        if (live) setExisting(list);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [visible, initialChoice]);

  const reset = () => {
    setName('');
    setChoice(initialChoice);
    setKind(null);
    setFundingId(null);
    setOpening('0');
    setCreditLimit('');
    setStatementDay('');
    setDueDay('');
    setWorth('');
    setError(null);
    createdId.current = null;
    setCurrency(getCachedCurrency());
  };

  // Closing after the account was created but its valuation failed: the account exists, so refresh the list
  // and start clean instead of leaving a half-done form that would create a duplicate on reopen.
  const close = () => {
    const partial = createdId.current !== null;
    if (partial) {
      reset();
      onCreated();
    }
    onClose();
  };

  const submit = () =>
    runAction(async () => {
      setError(null);
      if (!name.trim()) {
        setError('Enter a name');
        return;
      }
      const openingBalanceMinor = toMinor(parseFloat(opening || '0'));
      const creditLimitMinor =
        type === 'credit_card' && creditLimit ? toMinor(parseFloat(creditLimit)) : null;
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
      const tracking = tracked;
      const worthMinor = tracking && worth.trim() ? toMinor(parseFloat(worth)) : null;
      if (worthMinor !== null && (!Number.isFinite(worthMinor) || worthMinor < 0)) {
        setError('Enter what it is worth today');
        return;
      }
      setSaving(true);
      try {
        if (createdId.current === null) {
          const created = await createAccount({
            name: name.trim(),
            type,
            currency,
            openingBalanceMinor,
            creditLimitMinor,
            statementDay: days.statementDay,
            dueDay: days.dueDay,
            tracked: tracking,
            investmentKind: tracking ? kind : null,
            fundingAccountId: tracking ? fundingId : null,
          });
          createdId.current = created.id;
        }
        if (worthMinor !== null) {
          await addValuation(createdId.current, { date: toLocalIsoDate(new Date()), valueMinor: worthMinor });
        }
        reset();
        onCreated();
      } catch (e) {
        setError(errorMessage(e));
      } finally {
        setSaving(false);
      }
    });

  const trackingNow = tracked;
  const fundingOptions = fundingChoices(existing, currency);

  // The calm-sheets sign-off (Direction C): the new account's card, tinted
  // by the type you pick, with its opening balance.
  return (
    <ModalSheet
      dismissible={!saving}
      title="Account setup"
      visible={visible}
      onClose={close}
      footer={
        <View style={f.footerCol}>
          {error && <Text style={styles.errorText}>{error}</Text>}
          <PrimaryButton
            loading={saving}
            title={saving ? 'Saving…' : 'Create account'}
            onPress={submit}
            disabled={saving}
          />
        </View>
      }
    >
      <DraftCard
        hue={accountHue(type, accent)}
        icon={accountIcon(type, tracked)}
        title={name.trim() || 'New account'}
        kicker={ACCOUNT_CHOICES.find((t) => t.value === choice)?.label ?? ''}
      />
      <FormInput label="Name" value={name} onChangeText={setName} placeholder="e.g. HDFC Savings" />
      <Text style={styles.fieldLabel}>Type</Text>
      <View style={styles.chipRow}>
        {ACCOUNT_CHOICES.map((t) => (
          <Chip
            key={t.value}
            label={t.label}
            active={choice === t.value}
            onPress={() => {
              setChoice(t.value);
              if (t.value !== 'investment') setFundingId(null);
            }}
          />
        ))}
      </View>
      {choice === 'savings' && (
        <Text style={styles.hintText}>
          Move money in with a transfer; a withdrawal is a transfer back out.
        </Text>
      )}
      {choice === 'investment' && (
        <Text style={styles.hintText}>
          For an index fund, stocks, gold or a deposit: money moves in with a transfer or a SIP, and you tell
          Yume what it is worth.
        </Text>
      )}
      <Text style={styles.fieldLabel}>Currency</Text>
      <View style={styles.chipRow}>
        {SUPPORTED_CURRENCIES.map((c) => (
          <Chip
            key={c.code}
            label={c.code}
            active={currency === c.code}
            onPress={() => {
              currencyChosen.current = true;
              setCurrency(c.code);
            }}
          />
        ))}
      </View>
      <Text style={styles.hintText}>Fixed once the account has transactions.</Text>
      <View style={styles.pairRow}>
        <View style={styles.pairCell}>
          <AmountField
            label={trackingNow ? 'Invested so far' : 'Opening balance'}
            value={opening}
            onChangeText={setOpening}
            placeholder="0"
          />
        </View>
        {trackingNow && (
          <View style={styles.pairCell}>
            <AmountField
              label="Worth today (optional)"
              value={worth}
              onChangeText={setWorth}
              placeholder="Add it later"
            />
          </View>
        )}
      </View>
      {choice === 'investment' && (
        <InvestmentFields
          kind={kind}
          onKind={setKind}
          fundingId={fundingId}
          onFunding={setFundingId}
          choices={fundingOptions}
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
