import { memo, useState } from 'react';
import { SettingsRow } from '@/components/SettingsRow';
import { showAlert } from '@/components/AppDialog';
import { ToggleSwitch } from '@/components/ToggleSwitch';
import { setHideWidgetValues } from '@/db/settings';
import { theme } from '@/constants/theme';
import { errorMessage } from '@/lib/errorMessage';
import { refreshAllWidgets } from '@/widgets/notifyWidgets';

/**
 * The "Hide widget details" switch. It writes the setting and then refreshes the widgets; the saving state is this
 * part's own, so it is drawn alone while that runs.
 */
export const WidgetPrivacyRow = memo(function WidgetPrivacyRow({
  value,
  onChanged,
}: {
  /** Null until the setting has been read. */
  value: boolean | null;
  onChanged: (enabled: boolean) => void;
}) {
  const [saving, setSaving] = useState(false);
  const toggle = async (enabled: boolean) => {
    if (saving) return;
    setSaving(true);
    try {
      await setHideWidgetValues(enabled);
      onChanged(enabled);
      refreshAllWidgets();
    } catch (e) {
      showAlert('Couldn’t change widget privacy', errorMessage(e));
    } finally {
      setSaving(false);
    }
  };
  return (
    <SettingsRow
      compact
      icon="widgets-outline"
      iconBg={theme.colors.accentTint}
      label="Hide widget details"
      sub="Hide financial details on your home screen. Quick Add stays available."
      right={
        <ToggleSwitch
          accessibilityLabel="Hide widget details"
          value={value ?? false}
          disabled={value === null || saving}
          onChange={toggle}
        />
      }
      divider
    />
  );
});
