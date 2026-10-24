import { useSaveOnce } from '@/lib/useSaveOnce';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Text } from '@/components/Text';
import {
  updateAccount,
  listAccounts,
  archiveAccount,
  unarchiveAccount,
  deleteAccount,
  restoreAccount,
  getAccountTransactionCount,
} from '@/db/ledger';
import { toMinor, toMajor, formatMoney, formatMaskableMoney } from '@/lib/money';
import { usePrivacy } from '@/theme/PrivacyContext';
import type { Account, InvestmentKind } from '@/types';
import { ModalSheet, SheetLink } from '@/components/ModalSheet';
import { DraftCard } from '@/components/DraftCard';
import { modalFooterStyles as f } from '@/constants/theme';
import { useAccent } from '@/theme/AccentContext';
import { accountHue, accountIcon } from '@/lib/account';
import { FormInput } from '@/components/FormInput';
import { AmountField } from '@/components/AmountField';
import { AccountReservations } from '@/features/goals/AccountReservations';
import { PrimaryButton } from '@/components/PrimaryButton';
import { Chip } from '@/components/Chip';
import { useUndoToast } from '@/components/UndoToast';
import { haptics } from '@/lib/haptics';
import { styles } from './profile.styles';
import { ACCOUNT_CHOICES, choiceOf, typeOfChoice, type AccountChoice } from './profile.constants';
import { InvestmentFields, fundingChoices } from './InvestmentFields';
import { errorMessage } from '@/lib/errorMessage';
import { CardCycleFields } from './CardCycleFields';
import { parseCycleDays } from '@/lib/cardCycle';
import { showAlert } from '@/components/AppDialog';

/**
 * Edit/archive/delete an account. Currency is not editable (see `updateAccount`). Any transaction history
 * means Archive only (keeps past numbers); an unused account can be deleted.
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
  const runAction = useSaveOnce(async (action: () => Promise<void>) => {
    await action();
  });
  const [name, setName] = useState('');
  const [choice, setChoice] = useState<AccountChoice>('bank');
  const type = typeOfChoice(choice);
  const tracked = choice === 'investment';
  const [kind, setKind] = useState<InvestmentKind | null>(null);
  const [fundingId, setFundingId] = useState<string | null>(null);
  const [allAccounts, setAllAccounts] = useState<Account[]>([]);
  const [opening, setOpening] = useState('0');
  const [creditLimit, setCreditLimit] = useState('');
  const [statementDay, setStatementDay] = useState('');
  const [dueDay, setDueDay] = useState('');
  const [txCount, setTxCount] = useState<number | null>(null);
  // The usage check failed: we can't tell whether the account has history, so only the safe action
  // (archive) is offered, never delete.
  const [txCheckFailed, setTxCheckFailed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!account) return;
    setName(account.name);
    setChoice(choiceOf(account.type, !!account.investment));
    setKind(account.investment?.kind ?? null);
    setFundingId(account.investment?.fundingAccountId ?? null);
    setOpening(toMajor(account.openingBalanceMinor).toString());
    setCreditLimit(account.creditLimitMinor != null ? toMajor(account.creditLimitMinor).toString() : '');
    setStatementDay(account.statementDay != null ? String(account.statementDay) : '');
    setDueDay(account.dueDay != null ? String(account.dueDay) : '');
    setError(null);
    setTxCount(null);
    setTxCheckFailed(false);
    let cancelled = false;
    listAccounts()
      .then((list) => {
        if (!cancelled) setAllAccounts(list);
      })
      .catch(() => {});
    getAccountTransactionCount(account.id)
      .then((n) => {
        if (!cancelled) setTxCount(n);
      })
      .catch(() => {
        if (!cancelled) setTxCheckFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [account]);

  if (!account) return null;

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
      if (account.investment && !tracked) {
        const proceed = await new Promise<boolean>((resolve) =>
          showAlert(
            'Stop tracking its value?',
            'Its balance goes back to what your entries add up to. The value updates you saved are kept, in case you track it again.',
            [
              { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
              { text: 'Stop tracking', onPress: () => resolve(true) },
            ]
          )
        );
        if (!proceed) return;
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
          tracked,
          investmentKind: tracked ? kind : null,
          fundingAccountId: tracked ? fundingId : null,
        });
        onChanged();
      } catch (e) {
        setError(errorMessage(e));
      } finally {
        setSaving(false);
      }
    });

  const confirmArchive = () => {
    showAlert(
      'Archive this account?',
      'It disappears from account pickers and totals, but every past transaction against it stays exactly as it is. You can unarchive it later.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Archive',
          style: 'destructive',
          onPress: () =>
            runAction(async () => {
              setBusy(true);
              try {
                await archiveAccount(account.id);
                onChanged();
              } catch (e) {
                showAlert("Couldn't archive", errorMessage(e));
              } finally {
                setBusy(false);
              }
            }),
        },
      ]
    );
  };

  const onUnarchive = () =>
    runAction(async () => {
      setBusy(true);
      try {
        await unarchiveAccount(account.id);
        onChanged();
      } catch (e) {
        showAlert("Couldn't unarchive", errorMessage(e));
      } finally {
        setBusy(false);
      }
    });

  const deleteNow = () =>
    runAction(async () => {
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
    });

  const confirmDelete = () =>
    showAlert(`Delete "${account.name}"?`, 'You can undo this right after.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: deleteNow },
    ]);

  const trackingNow = tracked;

  // Calm-sheets layout: the account's own card, which retints as you change its type, then the form.
  // Archive/delete is a quiet link at the end, not a second button beside Save.
  return (
    <ModalSheet
      dismissible={!saving && !busy}
      title="Edit account"
      visible
      onClose={onClose}
      footer={
        <View style={f.footerCol}>
          {error && <Text style={styles.errorText}>{error}</Text>}
          <PrimaryButton
            loading={saving}
            title={saving ? 'Saving…' : 'Save changes'}
            onPress={submit}
            disabled={saving || busy}
          />
        </View>
      }
    >
      <DraftCard
        hue={accountHue(type, accent)}
        icon={accountIcon(type, tracked)}
        title={name.trim() || account.name}
        kicker={ACCOUNT_CHOICES.find((t) => t.value === choice)?.label ?? ''}
        figure={formatMaskableMoney(account.currentBalanceMinor, {
          currency: account.currency,
          masked: hideSavings,
        })}
        per={account.investment ? 'value' : 'balance'}
        meta={
          hideSavings
            ? undefined
            : account.investment
              ? `Invested ${formatMoney(account.investment.investedMinor, account.currency)}`
              : `Opened with ${formatMoney(toMinor(parseFloat(opening || '0')) || 0, account.currency)}`
        }
      />
      <AccountReservations account={account} onNavigate={onClose} />
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
      {choice === 'investment' && (
        <InvestmentFields
          kind={kind}
          onKind={setKind}
          fundingId={fundingId}
          onFunding={setFundingId}
          choices={fundingChoices(allAccounts, account.currency, account.id)}
        />
      )}
      <AmountField
        label={trackingNow ? 'Invested before Yume' : 'Opening balance'}
        value={opening}
        onChangeText={setOpening}
        placeholder="0"
      />
      {trackingNow && (
        <Text style={styles.hintText}>
          Only money put in earlier. Transfers you make in Yume are added on their own.
          {account.investment && !hideSavings
            ? ` Total invested: ${formatMoney(account.investment.investedMinor, account.currency)} (${formatMoney(account.openingBalanceMinor, account.currency)} earlier + ${formatMoney(account.investment.investedMinor - account.openingBalanceMinor, account.currency)} transferred in).`
            : ''}
        </Text>
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
      {account.archived ? (
        <SheetLink
          label={busy ? 'Working…' : 'Unarchive account'}
          onPress={onUnarchive}
          disabled={busy}
          danger={false}
        />
      ) : txCheckFailed ? (
        <>
          <Text style={styles.errorText}>
            Couldn't check whether this account has entries. You can still archive it.
          </Text>
          <SheetLink label={busy ? 'Working…' : 'Archive account'} onPress={confirmArchive} disabled={busy} />
        </>
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
