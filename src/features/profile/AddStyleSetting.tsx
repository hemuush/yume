import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { SegmentedControl } from '@/components/SegmentedControl';
import { Text } from '@/components/Text';
import { showAlert } from '@/components/AppDialog';
import { getAddStyle, setAddStyle, type AddStyle } from '@/db/settings';
import { errorMessage } from '@/lib/errorMessage';
import { theme } from '@/constants/theme';
import { themedStyles } from '@/theme/themedStyles';
import { styles } from './profile.styles';

const OPTIONS: { label: string; value: AddStyle }[] = [
  { label: 'Form', value: 'form' },
  { label: 'Chat', value: 'chat' },
];

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
    <View>
      <View style={styles.modeRow}>
        <Text style={styles.appearanceTitle}>Add an entry with</Text>
      </View>
      <View style={local.switch}>
        <SegmentedControl
          options={OPTIONS}
          value={style}
          onChange={(next) => {
            const before = style;
            setStyle(next);
            setAddStyle(next).catch((e) => {
              setStyle(before);
              showAlert('Couldn’t save', errorMessage(e));
            });
          }}
        />
      </View>
      <Text style={local.hint}>
        {style === 'chat'
          ? 'Suu asks one thing at a time and you tap your answer. You check it before anything is saved.'
          : 'Pick the amount, category and account on one screen.'}
      </Text>
    </View>
  );
}

const local = themedStyles(() =>
  StyleSheet.create({
    switch: { paddingHorizontal: 14, paddingTop: 10 },
    hint: {
      fontFamily: theme.font.body,
      fontSize: 12,
      lineHeight: 17,
      color: theme.colors.textMuted,
      paddingHorizontal: 14,
      paddingTop: 8,
      paddingBottom: 12,
    },
  })
);
