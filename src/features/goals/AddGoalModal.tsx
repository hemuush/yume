import { useState } from 'react';
import { View } from 'react-native';
import { Text } from '@/components/Text';
import { createSavingsGoal } from '@/db/savingsGoals';
import { toMinor, inputMinor, formatMoney } from '@/lib/money';
import { dayMonthYear } from '@/lib/dateLabels';
import { goalPlan } from './goalPlan';
import { toLocalIsoDate, addMonthsToIsoDate } from '@/lib/date';
import { DateField } from '@/components/DateField';
import { Account } from '@/types';
import { ModalSheet } from '@/components/ModalSheet';
import { DraftCard } from '@/components/DraftCard';
import { modalFooterStyles as f, theme } from '@/constants/theme';
import { FormInput } from '@/components/FormInput';
import { AmountField } from '@/components/AmountField';
import { PrimaryButton } from '@/components/PrimaryButton';
import { ToggleSwitch } from '@/components/ToggleSwitch';
import { GoalAccountField } from './GoalAccountField';
import { styles } from './goals.styles';
import { useSheetMutation } from '@/lib/useSheetMutation';

export function AddGoalModal(props: AddGoalProps) {
  return props.visible ? <AddGoalForm {...props} /> : null;
}

interface AddGoalProps {
  visible: boolean;
  accounts: Account[];
  onClose: () => void;
  onCreated: () => void | Promise<void>;
}

function AddGoalForm({ visible, accounts, onClose, onCreated }: AddGoalProps) {
  const today = toLocalIsoDate(new Date());
  const [name, setName] = useState('');
  const [target, setTarget] = useState('');
  const [hasTargetDate, setHasTargetDate] = useState(false);
  const [targetDateValue, setTargetDateValue] = useState(() => addMonthsToIsoDate(today, 12));
  const [linkedAccountId, setLinkedAccountId] = useState<string | null>(null);
  const [tracksAccount, setTracksAccount] = useState(false);
  const [reservesAccount, setReservesAccount] = useState(false);
  const [noteToSelf, setNoteToSelf] = useState('');
  const { run, pending: saving, saved, error, setError } = useSheetMutation();

  // A savings account is almost always where a goal's money really sits,
  // so picking one starts on Follow; any other account starts by hand.
  const pickAccount = (id: string | null) => {
    setLinkedAccountId(id);
    setReservesAccount(false);
    setTracksAccount(accounts.find((a) => a.id === id)?.type === 'savings');
  };

  const targetMinor = inputMinor(target);
  // The same monthly figure the goal screens show, worked out as if nothing were saved yet.
  const pace =
    hasTargetDate && targetMinor > 0
      ? goalPlan(
          {
            currentAmountMinor: 0,
            targetAmountMinor: targetMinor,
            targetDate: targetDateValue,
            createdAt: today,
          },
          today
        ).perMonthMinor
      : null;

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
    if (linkedAccountId && !accounts.some((a) => a.id === linkedAccountId && !a.archived)) {
      setError('Choose an available account or None');
      return;
    }
    await run(
      () =>
        createSavingsGoal({
          name: name.trim(),
          targetAmountMinor,
          targetDate,
          linkedAccountId,
          tracksAccount,
          reservesAccount,
          noteToSelf,
        }),
      onCreated
    );
  };

  return (
    <ModalSheet
      dismissible={!saving}
      title="Savings goal"
      visible={visible}
      onClose={onClose}
      footer={
        <View style={f.footerCol}>
          {error && <Text style={styles.errorText}>{error}</Text>}
          <PrimaryButton
            loading={saving}
            title={saving ? 'Saving…' : saved ? 'Goal saved' : 'Create goal'}
            onPress={submit}
            disabled={saving || saved}
          />
        </View>
      }
    >
      <View
        pointerEvents={saving || saved ? 'none' : 'auto'}
        accessibilityElementsHidden={saving || saved}
        importantForAccessibility={saving || saved ? 'no-hide-descendants' : 'auto'}
      >
        <DraftCard
          hue={theme.colors.secondary}
          icon="piggy-bank-outline"
          title={name.trim() || 'New goal'}
          kicker={hasTargetDate ? `Savings goal · by ${dayMonthYear(targetDateValue)}` : 'Savings goal'}
          figure={targetMinor > 0 ? formatMoney(targetMinor) : undefined}
          per="target"
          meta={
            pace != null
              ? `${formatMoney(pace)} a month to get there by ${dayMonthYear(targetDateValue)}`
              : undefined
          }
        />
        <FormInput
          label="Goal name"
          editable={!saving && !saved}
          value={name}
          onChangeText={setName}
          placeholder="e.g. Goa trip"
        />
        <AmountField
          label="Target amount"
          editable={!saving && !saved}
          value={target}
          onChangeText={setTarget}
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
          reserves={reservesAccount}
          onChangeReserves={setReservesAccount}
          onChangeAccount={pickAccount}
          onChangeTracks={setTracksAccount}
        />

        <FormInput
          label="Why this goal? (optional)"
          editable={!saving && !saved}
          value={noteToSelf}
          onChangeText={setNoteToSelf}
          placeholder="For the trip I keep putting off…"
          multiline
          numberOfLines={3}
          style={styles.noteInput}
        />
        <Text style={styles.modalHint}>Sealed until you finish saving — Suu hands it back to you then.</Text>
      </View>
    </ModalSheet>
  );
}
