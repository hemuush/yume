import { useSaveOnce } from '@/lib/useSaveOnce';
import { useState } from 'react';
import { View } from 'react-native';
import { Text } from '@/components/Text';
import { updateLoanAccount } from '@/db/loans';
import { Account } from '@/types';
import { PrimaryButton } from '@/components/PrimaryButton';
import { Chip } from '@/components/Chip';
import { ModalSheet } from '@/components/ModalSheet';
import { modalFooterStyles as f } from '@/constants/theme';
import { styles } from './loans.styles';
import { errorMessage } from '@/lib/errorMessage';
import { spendableAccountsOf, defaultCurrencyAccountsOf } from '@/lib/account';

export function AccountModal({
  accounts,
  currentAccountId,
  loanId,
  onClose,
  backLabel,
  onDone,
  direction = 'borrowed',
}: {
  accounts: Account[];
  currentAccountId: string | null;
  loanId: string;
  onClose: () => void;
  backLabel?: string;
  onDone: () => void;
  direction?: 'borrowed' | 'lent';
}) {
  const runAction = useSaveOnce(async (action: () => Promise<void>) => {
    await action();
  });
  const [selected, setSelected] = useState<string | null>(currentAccountId);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = () =>
    runAction(async () => {
      if (!selected) return;
      setError(null);
      setSaving(true);
      try {
        await updateLoanAccount(loanId, selected);
        onDone();
      } catch (e) {
        setError(errorMessage(e));
      } finally {
        setSaving(false);
      }
    });

  return (
    <ModalSheet
      backLabel={backLabel}
      dismissible={!saving}
      visible
      onClose={onClose}
      variant="center"
      title={direction === 'lent' ? 'Receiving account' : 'EMI account'}
      footer={
        <View style={f.footerCol}>
          {error && <Text style={styles.errorText}>{error}</Text>}
          <PrimaryButton
            loading={saving}
            title={saving ? 'Saving…' : 'Save'}
            onPress={submit}
            disabled={saving || !selected}
          />
        </View>
      }
    >
      <Text style={styles.hintText}>
        {direction === 'lent'
          ? 'Choose the account future repayments arrive in.'
          : 'Choose the account future EMIs come out of.'}{' '}
        This applies only to future entries; recorded transactions stay unchanged.
      </Text>
      <View style={styles.chipRow}>
        {defaultCurrencyAccountsOf(spendableAccountsOf(accounts)).map((acc) => (
          <Chip
            key={acc.id}
            label={acc.name}
            active={selected === acc.id}
            onPress={() => setSelected(acc.id)}
          />
        ))}
      </View>
    </ModalSheet>
  );
}
