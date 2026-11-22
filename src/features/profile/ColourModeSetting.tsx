import { memo, useState } from 'react';
import ReanimatedAnimated from 'react-native-reanimated';
import { SettingsRow } from '@/components/SettingsRow';
import { PANEL_ENTER, ROW_EXIT } from '@/lib/animation';
import type { AppearancePreference } from '@/theme/scheme';
import { AppearancePicker } from './AppearancePicker';

const LABEL: Record<AppearancePreference, string> = { system: 'System', light: 'Light', dark: 'Dark' };

/** The colour mode row: its value shows the choice, and the three pictures open in place under it. */
export const ColourModeSetting = memo(function ColourModeSetting({
  value,
  onChange,
}: {
  value: AppearancePreference;
  onChange: (next: AppearancePreference) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <SettingsRow
        compact
        icon="theme-light-dark"
        tone="coral"
        label="Colour mode"
        value={LABEL[value]}
        onPress={() => setOpen((v) => !v)}
        expanded={open}
      />
      {open && (
        <ReanimatedAnimated.View entering={PANEL_ENTER} exiting={ROW_EXIT}>
          <AppearancePicker value={value} onChange={onChange} />
        </ReanimatedAnimated.View>
      )}
    </>
  );
});
