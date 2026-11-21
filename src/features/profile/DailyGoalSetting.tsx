import { memo, useState } from 'react';
import { View } from 'react-native';
import ReanimatedAnimated from 'react-native-reanimated';
import { Text } from '@/components/Text';
import { AmountField } from '@/components/AmountField';
import { MovingRow } from '@/components/MovingRow';
import { PrimaryButton } from '@/components/PrimaryButton';
import { SettingsRow } from '@/components/SettingsRow';
import { setDailySpendingGoal } from '@/db/settings';
import { PANEL_ENTER, ROW_EXIT } from '@/lib/animation';
import { errorMessage } from '@/lib/errorMessage';
import { formatMoney, getCurrencySymbol, toMajor, toMinor } from '@/lib/money';
import { styles } from './profile.styles';

/**
 * The daily spending goal row (Home's "Today" strip; null is off). It expands in place to a field with Save and Clear.
 * Whether it is open, the draft text, an error and the saving state are this part's own, so typing draws the field, not
 * the whole Settings page. The draft is reset from the real value on open, so a typo never lingers after closing unsaved.
 */
export const DailyGoalSetting = memo(function DailyGoalSetting({
  goal,
  currency,
  loaded,
  stacked,
  onChanged,
}: {
  /** The saved goal in minor units, or null when there is none. */
  goal: number | null;
  currency: string;
  /** Both the goal and the currency have been read (otherwise the row says it is unavailable). */
  loaded: boolean;
  /** Large text: the value goes below the label. */
  stacked: boolean;
  /** The goal was saved (minor units) or cleared (null). */
  onChanged: (goal: number | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const toggle = () => {
    if (!open) setInput(goal != null ? String(toMajor(goal)) : '');
    setError(null);
    setOpen((v) => !v);
  };

  const save = async () => {
    setError(null);
    const minor = toMinor(parseFloat(input || '0'));
    if (!Number.isFinite(minor) || minor <= 0) {
      setError('Enter a valid daily amount');
      return;
    }
    setSaving(true);
    try {
      await setDailySpendingGoal(minor);
      onChanged(minor);
      setOpen(false);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const clear = async () => {
    setSaving(true);
    try {
      await setDailySpendingGoal(null);
      onChanged(null);
      setOpen(false);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <MovingRow>
        <SettingsRow
          compact
          icon="gauge"
          tone="sky"
          label="Daily spending goal"
          sub="Shown on Home each day"
          value={!loaded ? 'Unavailable' : goal != null ? `${formatMoney(goal, currency)}/day` : 'Not set'}
          valueBelow={stacked}
          onPress={toggle}
          expanded={open}
          divider
        />
      </MovingRow>
      {open && (
        <ReanimatedAnimated.View entering={PANEL_ENTER} exiting={ROW_EXIT} style={styles.accordionBody}>
          <AmountField
            label={`Amount per day (${getCurrencySymbol(currency)})`}
            value={input}
            onChangeText={setInput}
            placeholder="e.g. 800"
          />
          {error && <Text style={styles.errorText}>{error}</Text>}
          <View style={styles.dailyGoalBtnRow}>
            {goal != null && (
              <PrimaryButton
                title="Clear"
                variant="secondary"
                onPress={clear}
                disabled={saving}
                style={styles.dailyGoalBtn}
              />
            )}
            <PrimaryButton
              title={saving ? 'Saving…' : 'Save'}
              onPress={save}
              disabled={saving}
              style={styles.dailyGoalBtn}
            />
          </View>
        </ReanimatedAnimated.View>
      )}
    </>
  );
});
