import { useState } from 'react';
import { View } from 'react-native';
import { Text } from '@/components/Text';
import { ModalSheet } from '@/components/ModalSheet';
import { SheetTabs } from '@/components/SheetTabs';
import { PrimaryButton } from '@/components/PrimaryButton';
import { AmountField } from '@/components/AmountField';
import { DateField } from '@/components/DateField';
import { changeNextOccurrence } from '@/db/recurringOccurrence';
import type { RecurringRule } from '@/types';
import { toLocalIsoDate } from '@/lib/date';
import { inputMinor } from '@/lib/money';
import { errorMessage } from '@/lib/errorMessage';
import { styles } from './recurring.styles';
import { useSaveOnce } from '@/lib/useSaveOnce';

export function NextOccurrenceSheet({
  rule,
  onClose,
  onSaved,
}: {
  rule: RecurringRule;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [action, setAction] = useState<'change' | 'confirm' | 'skip'>('change');
  const [amount, setAmount] = useState(String((rule.nextAmountMinor ?? rule.amountMinor) / 100));
  const [due, setDue] = useState(rule.nextRunDate);
  const [paid, setPaid] = useState(toLocalIsoDate(new Date()));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const save = useSaveOnce(async () => {
    setBusy(true);
    setError('');
    try {
      await changeNextOccurrence(
        rule.id,
        rule.nextRunDate,
        action === 'skip'
          ? { kind: 'skip' }
          : {
              kind: action,
              date: action === 'confirm' ? paid : due,
              amountMinor:
                amount === String((rule.nextAmountMinor ?? rule.amountMinor) / 100)
                  ? (rule.nextAmountMinor ?? rule.amountMinor)
                  : inputMinor(amount),
            }
      );
      onSaved();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  });
  return (
    <ModalSheet
      visible
      title="This occurrence only"
      backLabel="Back to recurring entry"
      onClose={onClose}
      dismissible={!busy}
      footer={
        <View style={{ gap: 8 }}>
          {error ? <Text style={styles.errorText}>{error}</Text> : null}
          <PrimaryButton
            disabled={busy}
            title={
              busy
                ? 'Saving…'
                : action === 'skip'
                  ? 'Confirm skip'
                  : action === 'confirm'
                    ? 'Record payment'
                    : 'Save this occurrence'
            }
            onPress={save}
          />
        </View>
      }
    >
      <SheetTabs
        options={[
          { label: 'Change', value: 'change' },
          { label: 'Record', value: 'confirm' },
          { label: 'Skip', value: 'skip' },
        ]}
        value={action}
        onChange={setAction}
      />
      <Text style={styles.hint}>
        {action === 'skip'
          ? 'Skip the next occurrence without recording anything. The regular schedule continues.'
          : action === 'confirm'
            ? 'Record the actual amount and date once. The schedule moves on, so it is not recorded again automatically.'
            : 'Change this amount or postpone within this cycle. Later occurrences keep the regular amount and cadence.'}
      </Text>
      {action !== 'skip' && (
        <>
          <AmountField label="Actual amount" value={amount} onChangeText={setAmount} />
          <DateField
            label={action === 'confirm' ? 'Recorded date' : 'Due date'}
            value={action === 'confirm' ? paid : due}
            onChange={action === 'confirm' ? setPaid : setDue}
            minDate={action === 'change' ? rule.nextRunDate : undefined}
            maxDate={action === 'confirm' ? toLocalIsoDate(new Date()) : (rule.endDate ?? undefined)}
          />
        </>
      )}
    </ModalSheet>
  );
}
