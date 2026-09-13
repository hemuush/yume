import { useEffect, useState } from 'react';
import { View, Text } from 'react-native';
import { createSavingsGoal } from '@/db/savingsGoals';
import { toMinor } from '@/lib/money';
import { partsToIsoDate } from '@/lib/date';
import { Account } from '@/types';
import { ModalSheet } from '@/components/ModalSheet';
import { modalFooterStyles as f } from '@/constants/theme';
import { FormInput } from '@/components/FormInput';
import { PrimaryButton } from '@/components/PrimaryButton';
import { ToggleSwitch } from '@/components/ToggleSwitch';
import { Chip } from '@/components/Chip';
import { styles } from './goals.styles';

export function AddGoalModal({
  visible,
  accounts,
  onClose,
  onCreated,
}: {
  visible: boolean;
  accounts: Account[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const today = new Date();
  const [name, setName] = useState('');
  const [target, setTarget] = useState('');
  const [hasTargetDate, setHasTargetDate] = useState(false);
  const [day, setDay] = useState(String(today.getDate()));
  const [month, setMonth] = useState(String(today.getMonth() + 1));
  const [year, setYear] = useState(String(today.getFullYear() + 1));
  const [linkedAccountId, setLinkedAccountId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    setName('');
    setTarget('');
    setHasTargetDate(false);
    setDay(String(today.getDate()));
    setMonth(String(today.getMonth() + 1));
    setYear(String(today.getFullYear() + 1));
    setLinkedAccountId(null);
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const submit = async () => {
    setError(null);
    if (!name.trim()) {
      setError('Enter a name');
      return;
    }
    const targetAmountMinor = toMinor(parseFloat(target || '0'));
    if (!Number.isFinite(targetAmountMinor) || targetAmountMinor <= 0) {
      setError('Enter a valid target amount');
      return;
    }
    let targetDate: string | null = null;
    if (hasTargetDate) {
      targetDate = partsToIsoDate(year, month, day);
      if (!targetDate) {
        setError('Enter a valid target date');
        return;
      }
    }
    setSaving(true);
    try {
      await createSavingsGoal({ name: name.trim(), targetAmountMinor, targetDate, linkedAccountId });
      onCreated();
    } catch (e: any) {
      setError(String(e?.message ?? e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalSheet
      visible={visible}
      onClose={onClose}
      title="New Savings Goal"
      footer={
        <View style={f.footerCol}>
          {error && <Text style={styles.errorText}>{error}</Text>}
          <View style={f.footerRow}>
            <PrimaryButton title="Cancel" variant="secondary" onPress={onClose} style={f.footerBtn} />
            <PrimaryButton
              title={saving ? 'Creating...' : 'Create goal'}
              onPress={submit}
              disabled={saving}
              style={f.footerBtn}
            />
          </View>
        </View>
      }
    >
      <FormInput label="Goal name" value={name} onChangeText={setName} placeholder="e.g. Goa Trip" />
      <FormInput
        label="Target amount"
        value={target}
        onChangeText={setTarget}
        keyboardType="numeric"
        placeholder="e.g. 40000"
      />

      <View style={styles.toggleRow}>
        <Text style={styles.fieldLabel}>By a specific date</Text>
        <ToggleSwitch value={hasTargetDate} onChange={setHasTargetDate} />
      </View>
      {hasTargetDate && (
        <View style={styles.dateFieldsRow}>
          <View style={{ flex: 1 }}>
            <FormInput
              label="Day"
              value={day}
              onChangeText={setDay}
              keyboardType="numeric"
              placeholder="DD"
              style={styles.dateFieldInput}
            />
          </View>
          <View style={{ flex: 1 }}>
            <FormInput
              label="Month"
              value={month}
              onChangeText={setMonth}
              keyboardType="numeric"
              placeholder="MM"
              style={styles.dateFieldInput}
            />
          </View>
          <View style={{ flex: 1.3 }}>
            <FormInput
              label="Year"
              value={year}
              onChangeText={setYear}
              keyboardType="numeric"
              placeholder="YYYY"
              style={styles.dateFieldInput}
            />
          </View>
        </View>
      )}

      {accounts.length > 0 && (
        <>
          <Text style={styles.fieldLabel}>Keeping it in (optional)</Text>
          <View style={styles.chipRow}>
            <Chip label="None" active={linkedAccountId === null} onPress={() => setLinkedAccountId(null)} />
            {accounts.map((a) => (
              <Chip
                key={a.id}
                label={a.name}
                active={linkedAccountId === a.id}
                onPress={() => setLinkedAccountId(a.id)}
              />
            ))}
          </View>
          <Text style={styles.modalHint}>
            Just a label for where this money actually sits — adding to this goal never touches the account's
            own balance.
          </Text>
        </>
      )}
    </ModalSheet>
  );
}
