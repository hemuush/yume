import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Text } from '@/components/Text';
import { createSavingsGoal } from '@/db/savingsGoals';
import { toMinor, inputMinor } from '@/lib/money';
import { toLocalIsoDate, addMonthsToIsoDate } from '@/lib/date';
import { DateField } from '@/components/DateField';
import { Account } from '@/types';
import { ModalSheet } from '@/components/ModalSheet';
import { modalFooterStyles as f } from '@/constants/theme';
import { FormInput } from '@/components/FormInput';
import { PrimaryButton } from '@/components/PrimaryButton';
import { ToggleSwitch } from '@/components/ToggleSwitch';
import { GoalAccountField } from './GoalAccountField';
import { GoalSheetCard } from './GoalSheetCard';
import { styles } from './goals.styles';
import { errorMessage } from '@/lib/errorMessage';

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
  const today = toLocalIsoDate(new Date());
  const [name, setName] = useState('');
  const [target, setTarget] = useState('');
  const [hasTargetDate, setHasTargetDate] = useState(false);
  const [targetDateValue, setTargetDateValue] = useState(() => addMonthsToIsoDate(today, 12));
  const [linkedAccountId, setLinkedAccountId] = useState<string | null>(null);
  const [tracksAccount, setTracksAccount] = useState(false);
  const [noteToSelf, setNoteToSelf] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    setName('');
    setTarget('');
    setHasTargetDate(false);
    setTargetDateValue(addMonthsToIsoDate(today, 12));
    setLinkedAccountId(null);
    setTracksAccount(false);
    setNoteToSelf('');
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  // A savings account is almost always where a goal's money really sits,
  // so picking one starts on Follow; any other account starts by hand.
  const pickAccount = (id: string | null) => {
    setLinkedAccountId(id);
    setTracksAccount(accounts.find((a) => a.id === id)?.type === 'savings');
  };

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
    const targetDate = hasTargetDate ? targetDateValue : null;
    setSaving(true);
    try {
      await createSavingsGoal({
        name: name.trim(),
        targetAmountMinor,
        targetDate,
        linkedAccountId,
        tracksAccount,
        noteToSelf,
      });
      onCreated();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalSheet
      visible={visible}
      onClose={onClose}
      footer={
        <View style={f.footerCol}>
          {error && <Text style={styles.errorText}>{error}</Text>}
          <PrimaryButton title={saving ? 'Creating…' : 'Create goal'} onPress={submit} disabled={saving} />
        </View>
      }
    >
      <GoalSheetCard
        name={name.trim() || 'New goal'}
        savedMinor={0}
        targetMinor={inputMinor(target)}
        targetDate={hasTargetDate ? targetDateValue : null}
      />
      <FormInput label="Goal name" value={name} onChangeText={setName} placeholder="e.g. Goa trip" />
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
        <DateField
          label="Target date"
          value={targetDateValue}
          onChange={setTargetDateValue}
          minDate={today}
        />
      )}

      <GoalAccountField
        accounts={accounts}
        accountId={linkedAccountId}
        tracks={tracksAccount}
        onChangeAccount={pickAccount}
        onChangeTracks={setTracksAccount}
      />

      <FormInput
        label="Why this goal? (optional)"
        value={noteToSelf}
        onChangeText={setNoteToSelf}
        placeholder="For the trip I keep putting off…"
        multiline
        numberOfLines={3}
        style={styles.noteInput}
      />
      <Text style={styles.modalHint}>Sealed until you finish saving — Suu hands it back to you then.</Text>
    </ModalSheet>
  );
}
