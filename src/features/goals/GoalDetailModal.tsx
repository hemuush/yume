import { useEffect, useState } from 'react';
import { View, Alert } from 'react-native';
import { Text } from '@/components/Text';
import {
  updateSavingsGoal,
  archiveSavingsGoal,
  unarchiveSavingsGoal,
  deleteSavingsGoal,
  restoreSavingsGoal,
} from '@/db/savingsGoals';
import { toMinor } from '@/lib/money';
import { partsToIsoDate, parseLocalIsoDate } from '@/lib/date';
import { Account, SavingsGoal } from '@/types';
import { ModalSheet } from '@/components/ModalSheet';
import { modalFooterStyles as f } from '@/constants/theme';
import { FormInput } from '@/components/FormInput';
import { PrimaryButton } from '@/components/PrimaryButton';
import { ToggleSwitch } from '@/components/ToggleSwitch';
import { Chip } from '@/components/Chip';
import { useUndoToast } from '@/components/UndoToast';
import { haptics } from '@/lib/haptics';
import { styles } from './goals.styles';

/**
 * Editing/archiving/deleting a goal, opened by tapping a GoalCard. Same
 * danger-zone split as AccountDetailModal: any real progress
 * (`currentAmountMinor > 0`) means Archive is the only option (hides it,
 * keeps the number intact); a goal that was never funded can be properly
 * deleted.
 */
export function GoalDetailModal({
  goal,
  accounts,
  onClose,
  onChanged,
}: {
  goal: SavingsGoal | null;
  accounts: Account[];
  onClose: () => void;
  onChanged: () => void;
}) {
  const { show: showUndo } = useUndoToast();
  const [name, setName] = useState('');
  const [target, setTarget] = useState('');
  const [hasTargetDate, setHasTargetDate] = useState(false);
  const [day, setDay] = useState('1');
  const [month, setMonth] = useState('1');
  const [year, setYear] = useState('2026');
  const [linkedAccountId, setLinkedAccountId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!goal) return;
    setName(goal.name);
    setTarget((goal.targetAmountMinor / 100).toString());
    setLinkedAccountId(goal.linkedAccountId);
    if (goal.targetDate) {
      setHasTargetDate(true);
      const d = parseLocalIsoDate(goal.targetDate);
      setDay(String(d.getDate()));
      setMonth(String(d.getMonth() + 1));
      setYear(String(d.getFullYear()));
    } else {
      setHasTargetDate(false);
    }
    setError(null);
  }, [goal]);

  if (!goal) return null;

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
      await updateSavingsGoal(goal.id, { name: name.trim(), targetAmountMinor, targetDate, linkedAccountId });
      onChanged();
    } catch (e: any) {
      setError(String(e?.message ?? e));
    } finally {
      setSaving(false);
    }
  };

  const confirmArchive = () => {
    Alert.alert(
      'Archive this goal?',
      'It disappears from the active list, but its saved amount stays exactly as it is. You can unarchive it later.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Archive',
          style: 'destructive',
          onPress: async () => {
            setBusy(true);
            try {
              await archiveSavingsGoal(goal.id);
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
      await unarchiveSavingsGoal(goal.id);
      onChanged();
    } catch (e: any) {
      Alert.alert('Could not unarchive', String(e?.message ?? e));
    } finally {
      setBusy(false);
    }
  };

  const confirmDelete = async () => {
    setBusy(true);
    try {
      const snapshot = await deleteSavingsGoal(goal.id);
      haptics.warn();
      onChanged();
      showUndo(`Deleted "${goal.name}"`, async () => {
        await restoreSavingsGoal(snapshot);
        onChanged();
      });
    } catch (e: any) {
      Alert.alert('Could not delete', String(e?.message ?? e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <ModalSheet
      visible
      onClose={onClose}
      title="Edit Goal"
      footer={
        <View style={f.footerCol}>
          {error && <Text style={styles.errorText}>{error}</Text>}
          <View style={f.footerRow}>
            <PrimaryButton
              title="Cancel"
              variant="secondary"
              onPress={onClose}
              style={f.footerBtn}
              disabled={saving || busy}
            />
            <PrimaryButton
              title={saving ? 'Saving...' : 'Save'}
              onPress={submit}
              disabled={saving || busy}
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
        </>
      )}

      {goal.letterRevealed && goal.noteToSelf && (
        <>
          <Text style={styles.fieldLabel}>Why you started this</Text>
          <Text style={styles.letterNote}>&ldquo;{goal.noteToSelf}&rdquo;</Text>
        </>
      )}

      <Text style={styles.dangerLabel}>DANGER ZONE</Text>
      {goal.archived ? (
        <PrimaryButton
          title={busy ? 'Working...' : 'Unarchive goal'}
          variant="secondary"
          onPress={onUnarchive}
          disabled={busy}
        />
      ) : goal.currentAmountMinor > 0 ? (
        <PrimaryButton
          title={busy ? 'Working...' : 'Archive goal (has progress)'}
          variant="secondary"
          onPress={confirmArchive}
          disabled={busy}
          style={styles.deleteButton}
        />
      ) : (
        <PrimaryButton
          title={busy ? 'Working...' : 'Delete goal'}
          variant="secondary"
          onPress={confirmDelete}
          disabled={busy}
          style={styles.deleteButton}
        />
      )}
    </ModalSheet>
  );
}
