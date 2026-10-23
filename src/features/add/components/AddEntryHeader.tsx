import { Pressable } from 'react-native';
import { Text } from '@/components/Text';
import Feather from '@expo/vector-icons/Feather';
import { theme } from '@/constants/theme';
import { SkyHeader } from '@/features/home/SkyHeader';
import { SegmentedControl } from '@/components/SegmentedControl';
import { styles } from '@/features/add/add.styles';
import { ADD_TYPES, EDIT_TYPES } from '@/features/add/addEntry';
import { withPressedTint } from '@/lib/pressed';
import { useAccent } from '@/theme/AccentContext';
import type { AddEntryModel } from '@/features/add/types/addEntryModel';
import type { ReactElement } from 'react';

type Props = {
  model: Pick<
    AddEntryModel,
    | 'title'
    | 'editingId'
    | 'editing'
    | 'isLinked'
    | 'onDelete'
    | 'saving'
    | 'addingRow'
    | 'saveDone'
    | 'formReady'
    | 'openRepeatSheet'
    | 'type'
    | 'onTypeChange'
    | 'formBusy'
  >;
};
export function AddEntryHeader({ model }: Props): ReactElement {
  const { accent } = useAccent();
  const {
    title,
    editingId,
    editing,
    isLinked,
    onDelete,
    saving,
    addingRow,
    saveDone,
    formReady,
    openRepeatSheet,
    type,
    onTypeChange,
    formBusy,
  } = model;

  return (
    <SkyHeader
      title={title}
      showBack
      hideUser
      wallpaper
      closeIcon
      actions={
        editingId ? (
          editing && !isLinked ? (
            <Pressable
              onPress={onDelete}
              disabled={saving || addingRow || saveDone}
              accessibilityState={{ disabled: saving || addingRow || saveDone }}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Delete entry"
              style={withPressedTint(accent, styles.trashBtn)}
            >
              <Feather name="trash-2" size={16} color={theme.colors.expense} />
            </Pressable>
          ) : undefined
        ) : (
          <Pressable
            onPress={openRepeatSheet}
            disabled={!formReady || saving || addingRow || saveDone}
            accessibilityState={{ disabled: !formReady || saving || addingRow || saveDone }}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Repeat a recent entry"
            style={withPressedTint(accent, styles.repeatBtn)}
          >
            <Feather name="rotate-ccw" size={13} color={theme.colors.textPrimary} />
            <Text style={styles.repeatBtnText}>Repeat</Text>
          </Pressable>
        )
      }
    >
      <SegmentedControl
        options={editingId ? EDIT_TYPES : ADD_TYPES}
        value={type}
        onChange={onTypeChange}
        disabled={!formReady || formBusy}
        onBand
      />
    </SkyHeader>
  );
}
