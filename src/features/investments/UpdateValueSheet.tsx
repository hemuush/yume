import { useEffect, useState } from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { Text } from '@/components/Text';
import { ModalSheet, SheetFooter } from '@/components/ModalSheet';
import { SheetCard } from '@/components/SheetCard';
import { AmountField } from '@/components/AmountField';
import { DateField } from '@/components/DateField';
import { PrimaryButton } from '@/components/PrimaryButton';
import { useUndoToast } from '@/components/UndoToast';
import { theme, modalFooterStyles as f } from '@/constants/theme';
import { useAccent } from '@/theme/AccentContext';
import { usePrivacy } from '@/theme/PrivacyContext';
import { accountHue, accountIcon } from '@/lib/account';
import { formatMoney, formatMaskableMoney, inputMinor, toMinor } from '@/lib/money';
import { toLocalIsoDate } from '@/lib/date';
import { shade } from '@/lib/color';
import { errorMessage } from '@/lib/errorMessage';
import { haptics } from '@/lib/haptics';
import { gainLabel } from '@/lib/investment';
import { addValuation, updateValuation, deleteValuation, restoreValuation, Valuation } from '@/db/valuations';
import type { Account } from '@/types';

/**
 * Records what a tracked account is worth now, or edits/deletes an earlier update. The estimate chip is the
 * last update plus whatever moved since, so a month with no news is one tap.
 */
export function UpdateValueSheet({
  account,
  valuation,
  visible,
  onClose,
  onSaved,
  onDeleted,
}: {
  account: Account;
  /** An earlier update being edited; omitted when adding a new one. */
  valuation?: Valuation | null;
  visible: boolean;
  onClose: () => void;
  onSaved: () => void;
  /** After a delete, once the undo toast is up — the caller closes whatever sits behind this sheet. */
  onDeleted: () => void;
}) {
  const { accent } = useAccent();
  const { hideAmounts } = usePrivacy();
  const { show: showUndo } = useUndoToast();
  const inv = account.investment;
  const today = toLocalIsoDate(new Date());
  const [value, setValue] = useState('');
  const [date, setDate] = useState(today);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    setValue(valuation ? String(valuation.valueMinor / 100) : '');
    setDate(valuation ? valuation.date : today);
    setError(null);
    // `today` only matters at open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, valuation?.id]);

  if (!inv) return null;
  const masked = hideAmounts;
  const money = (minor: number) => formatMaskableMoney(minor, { currency: account.currency, masked });
  const typed = inputMinor(value);
  const estimate = !valuation && inv.valuedAt && date === today ? account.currentBalanceMinor : null;
  const sinceMinor = inv.lastValueMinor != null ? account.currentBalanceMinor - inv.lastValueMinor : 0;

  // The gain after this value, for a value as of today: what it is worth now,
  // plus what was taken out, minus what went in.
  const newGain = typed > 0 && date === today ? typed + inv.takenOutMinor - inv.investedMinor : null;
  const before = gainLabel(inv, { currency: account.currency, masked, moneyOnly: true });
  const after =
    newGain == null
      ? null
      : gainLabel(
          { gainMinor: newGain, investedMinor: inv.investedMinor },
          { currency: account.currency, masked }
        );

  const submit = async () => {
    setError(null);
    const valueMinor = toMinor(parseFloat(value || ''));
    if (!value.trim() || !Number.isFinite(valueMinor) || valueMinor < 0) {
      setError('Enter what it is worth');
      return;
    }
    setSaving(true);
    try {
      if (valuation) await updateValuation(valuation.id, { date, valueMinor });
      else await addValuation(account.id, { date, valueMinor });
      haptics.confirm();
      onSaved();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!valuation) return;
    setSaving(true);
    try {
      const snapshot = await deleteValuation(valuation.id);
      haptics.warn();
      onDeleted();
      showUndo('Deleted that value', async () => {
        await restoreValuation(snapshot);
        onSaved();
      });
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
          <SheetFooter
            onDelete={valuation ? remove : undefined}
            deleteLabel="Delete this value"
            disabled={saving}
          >
            <PrimaryButton
              title={saving ? 'Saving…' : 'Save value'}
              onPress={submit}
              disabled={saving}
              style={f.footerBtn}
            />
          </SheetFooter>
        </View>
      }
    >
      <SheetCard
        hue={accountHue(account.type, accent)}
        icon={accountIcon(account.type)}
        kicker={valuation ? 'edit value' : 'update value'}
        amount={
          masked
            ? money(0)
            : formatMoney(typed || valuation?.valueMinor || account.currentBalanceMinor, account.currency)
        }
        title={account.name}
        meta={typed > 0 ? 'Worth' : `Invested ${money(inv.investedMinor)}`}
      />
      <AmountField
        label="What is it worth today?"
        value={value}
        onChangeText={setValue}
        placeholder="e.g. 44560"
        autoFocus
      />
      {estimate != null && (
        <View style={styles.estimateRow}>
          <Pressable
            onPress={() => setValue(String(estimate / 100))}
            style={({ pressed }) => [
              styles.estimateChip,
              { backgroundColor: shade(accent, 95) },
              pressed && styles.pressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel={`Use the estimate ${money(estimate)}`}
          >
            <Text style={styles.estimateText}>Use {money(estimate)}</Text>
          </Pressable>
          <Text style={styles.estimateHint}>
            {sinceMinor > 0
              ? `Your last update plus the ${money(sinceMinor)} you've put in since.`
              : sinceMinor < 0
                ? `Your last update minus the ${money(-sinceMinor)} you've taken out since.`
                : 'Your last update, nothing has moved since.'}
          </Text>
        </View>
      )}
      <DateField label="As of" value={date} onChange={setDate} maxDate={today} pastFacing />
      {before != null && after != null && (
        <View style={styles.strip}>
          <Text style={styles.stripText}>
            Gain was {before}, becomes {after}
          </Text>
        </View>
      )}
    </ModalSheet>
  );
}

const styles = StyleSheet.create({
  errorText: { fontFamily: theme.font.body, color: theme.colors.expenseText, fontSize: 13, marginBottom: 12 },
  estimateRow: { gap: 8, marginTop: -4, marginBottom: 14 },
  estimateChip: {
    alignSelf: 'flex-start',
    borderRadius: theme.radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  pressed: { opacity: 0.7 },
  estimateText: { fontFamily: theme.font.monoBold, fontSize: 12, color: theme.colors.textPrimary },
  estimateHint: { fontFamily: theme.font.body, fontSize: 12, color: theme.colors.textMuted, lineHeight: 17 },
  strip: {
    backgroundColor: theme.colors.inkWash,
    borderRadius: theme.radius.lg,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 4,
  },
  stripText: { fontFamily: theme.font.body, fontSize: 12.5, color: theme.colors.textSecondary },
});
