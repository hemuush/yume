import { memo } from 'react';
import { View } from 'react-native';
import { Text } from '@/components/Text';
import { AmountField } from '@/components/AmountField';
import { Chip } from '@/components/Chip';
import { DateField } from '@/components/DateField';
import { FormInput } from '@/components/FormInput';
import { inputMinor, formatMoney } from '@/lib/money';
import type { Account } from '@/types';
import { styles } from './people.styles';
import { useSettleForm, type SettleForm as SettleFormStore } from './settleFormStore';

/**
 * A person's Settle page: how much, a note, the date, and whether cash moved. Its fields live in `form`, so typing draws
 * this page alone.
 */
export const SettleForm = memo(function SettleForm({
  form,
  accounts,
  dispBalanceMinor,
  error,
}: {
  form: SettleFormStore;
  /** The accounts cash can move through. */
  accounts: Account[];
  /** The balance as shown (rounded), signed: positive when they owe you. */
  dispBalanceMinor: number;
  error: string | null;
}) {
  const { amount, note, dateIso, accountId } = useSettleForm(form);
  return (
    <>
      <AmountField label="Amount" value={amount} onChangeText={form.setAmount} placeholder="0" />
      {dispBalanceMinor !== 0 && (
        // One tap fills the whole balance, the usual way a friend's tab gets settled.
        <View style={styles.settleRow}>
          <Chip
            label={`Settle ${formatMoney(Math.abs(dispBalanceMinor))}`}
            active={inputMinor(amount) === Math.abs(dispBalanceMinor)}
            onPress={() => form.setAmount(String(Math.abs(dispBalanceMinor) / 100))}
          />
        </View>
      )}
      <FormInput
        label="Note (optional)"
        value={note}
        onChangeText={form.setNote}
        placeholder="e.g. Dinner split"
      />

      <DateField label="Date" value={dateIso} onChange={form.setDate} pastFacing />

      <Text style={styles.fieldLabel}>Did cash actually move?</Text>
      <View style={styles.chipRow}>
        <Chip label="Just adjust balance" active={accountId === null} onPress={() => form.setAccount(null)} />
        {accounts.map((acc) => (
          <Chip
            key={acc.id}
            label={acc.name}
            active={accountId === acc.id}
            onPress={() => form.setAccount(acc.id)}
          />
        ))}
      </View>
      <Text style={styles.hintText}>
        {accountId
          ? dispBalanceMinor < 0
            ? '“I owe more” adds money to the account; “I paid them back” takes it out.'
            : '“They owe more” takes money from the account; “They repaid” adds it.'
          : 'Balance only adjusts what’s owed. Choose an account if money moved.'}
      </Text>

      {error && <Text style={styles.errorText}>{error}</Text>}
    </>
  );
});
