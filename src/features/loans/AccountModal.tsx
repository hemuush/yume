import { useState } from 'react';
import { View, Text } from 'react-native';
import { updateLoanAccount } from '@/db/loans';
import { Account } from '@/types';
import { PrimaryButton } from '@/components/PrimaryButton';
import { Chip } from '@/components/Chip';
import { ModalSheet } from '@/components/ModalSheet';
import { styles } from './loans.styles';

export function AccountModal({
  accounts,
  currentAccountId,
  loanId,
  onClose,
  onDone,
}: {
  accounts: Account[];
  currentAccountId: string | null;
  loanId: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const [selected, setSelected] = useState<string | null>(currentAccountId);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!selected) return;
    setError(null);
    setSaving(true);
    try {
      await updateLoanAccount(loanId, selected);
      onDone();
    } catch (e: any) {
      setError(String(e?.message ?? e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalSheet visible onClose={onClose} variant="center" title="EMI account">
      <Text style={styles.hintText}>
        Which account future EMIs for this loan come out of. This only changes payments made from here on — it
        never rewrites transactions already recorded.
      </Text>
      <View style={styles.chipRow}>
        {accounts.map((acc) => (
          <Chip
            key={acc.id}
            label={acc.name}
            active={selected === acc.id}
            onPress={() => setSelected(acc.id)}
          />
        ))}
      </View>
      {error && <Text style={styles.errorText}>{error}</Text>}
      <View style={styles.modalActions}>
        <PrimaryButton
          title="Cancel"
          variant="secondary"
          onPress={onClose}
          disabled={saving}
          style={{ flex: 1, marginRight: 8 }}
        />
        <PrimaryButton
          title={saving ? 'Saving...' : 'Save'}
          onPress={submit}
          disabled={saving || !selected}
          style={{ flex: 1 }}
        />
      </View>
    </ModalSheet>
  );
}
