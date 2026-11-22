import { useEffect, useState } from 'react';
import { SettingsRow } from '@/components/SettingsRow';
import { ToggleSwitch } from '@/components/ToggleSwitch';
import { showAlert } from '@/components/AppDialog';
import { getAddStyle, setAddStyle, type AddStyle } from '@/db/settings';
import { errorMessage } from '@/lib/errorMessage';

/**
 * How the + button adds an entry: the form (amount pad and pickers on one screen), or a chat where Suu asks one thing
 * at a time, in the form's order, and the answer is a tap on a card. Both save the same way, and each screen has a
 * link to the other, so this only sets which one + opens first.
 */
export function AddStyleSetting() {
  const [style, setStyle] = useState<AddStyle>('form');
  useEffect(() => {
    let live = true;
    getAddStyle()
      .then((value) => live && setStyle(value))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);
  return (
    <SettingsRow
      compact
      icon="message-text-outline"
      tone="coral"
      label="Add by chat"
      divider
      sub={
        style === 'chat'
          ? 'Suu asks one thing at a time. You tap your answer.'
          : 'Off: one screen with the amount pad and pickers.'
      }
      right={
        <ToggleSwitch
          accessibilityLabel="Add by chat"
          value={style === 'chat'}
          onChange={(on) => {
            const before = style;
            const next: AddStyle = on ? 'chat' : 'form';
            setStyle(next);
            setAddStyle(next).catch((e) => {
              setStyle(before);
              showAlert('Couldn’t save', errorMessage(e));
            });
          }}
        />
      }
    />
  );
}
