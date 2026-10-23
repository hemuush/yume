import { Pressable, View } from 'react-native';
import { Text } from '@/components/Text';
import { KeyboardStickyView } from 'react-native-keyboard-controller';
import Feather from '@expo/vector-icons/Feather';
import { theme } from '@/constants/theme';
import { PrimaryButton } from '@/components/PrimaryButton';
import { styles } from '@/features/add/add.styles';
import { AmountPad } from '@/components/AmountPad';
import { AddDetailRow } from '@/features/add/AddDetailRow';
import { withPressedTint } from '@/lib/pressed';
import { useAccent } from '@/theme/AccentContext';
import type { AddEntryModel } from '@/features/add/types/addEntryModel';
import type { ReactElement } from 'react';

type Props = {
  model: Pick<
    AddEntryModel,
    | 'saveTitle'
    | 'saveDone'
    | 'saving'
    | 'submit'
    | 'splitParts'
    | 'formReady'
    | 'addingRow'
    | 'isLinked'
    | 'cannotSave'
    | 'currentProblem'
    | 'editingId'
    | 'addRow'
    | 'setFooterHeight'
    | 'insets'
    | 'error'
    | 'repeatWarning'
    | 'invalidAmount'
    | 'rows'
    | 'formBusy'
    | 'type'
    | 'effectiveAccount'
    | 'date'
    | 'today'
    | 'yesterday'
    | 'note'
    | 'noteEditing'
    | 'refund'
    | 'setNote'
    | 'setNoteEditing'
    | 'setAccountSheetOpen'
    | 'setCalendarOpen'
    | 'setRefund'
    | 'setError'
    | 'openSplit'
    | 'padVisible'
    | 'setPadOpen'
    | 'onPadKey'
    | 'clearAmount'
    | 'padTone'
  >;
};
export function AddEntryFooter({ model }: Props): ReactElement {
  const { accent } = useAccent();
  const {
    saveTitle,
    saveDone,
    saving,
    submit,
    splitParts,
    formReady,
    addingRow,
    isLinked,
    cannotSave,
    currentProblem,
    editingId,
    addRow,
    setFooterHeight,
    insets,
    error,
    repeatWarning,
    invalidAmount,
    rows,
    formBusy,
    type,
    effectiveAccount,
    date,
    today,
    yesterday,
    note,
    noteEditing,
    refund,
    setNote,
    setNoteEditing,
    setAccountSheetOpen,
    setCalendarOpen,
    setRefund,
    setError,
    openSplit,
    padVisible,
    setPadOpen,
    onPadKey,
    clearAmount,
    padTone,
  } = model;

  const saveButton = (
    <PrimaryButton
      title={saveTitle}
      icon="check"
      done={saveDone}
      loading={saving && !saveDone}
      onPress={submit}
      disabled={!formReady || saving || addingRow || saveDone || isLinked || cannotSave}
      style={styles.saveBtn}
    />
  );

  const addToListDisabled = !formReady || saving || addingRow || saveDone || !!currentProblem;

  const addToListButton = !editingId && !splitParts && (
    <Pressable
      onPress={addRow}
      disabled={addToListDisabled}
      style={withPressedTint(accent, [styles.addToList, addToListDisabled && styles.actionDisabled])}
      accessibilityRole="button"
      accessibilityState={{ disabled: addToListDisabled }}
      accessibilityHint="Keeps this entry on a list and starts the next one; Save saves them all"
    >
      <Feather name="plus" size={14} color={theme.colors.textPrimary} />
      <Text style={styles.addToListText}>{addingRow ? 'Adding…' : 'Add more'}</Text>
    </Pressable>
  );
  return (
    <KeyboardStickyView
      onLayout={(e) => setFooterHeight(e.nativeEvent.layout.height)}
      offset={{ opened: insets.bottom }}
      style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}
    >
      {!error && !repeatWarning && !splitParts && !invalidAmount && currentProblem && (
        <View style={styles.footerStatus}>
          <Text style={styles.formHint}>
            {invalidAmount ? 'Enter a positive amount. Check the calculation.' : currentProblem}
          </Text>
        </View>
      )}
      {rows.length > 0 && <Text style={styles.queueHint}>{rows.length} on your list</Text>}
      {error && <Text style={styles.error}>{error}</Text>}
      <View
        pointerEvents={formBusy || !formReady ? 'none' : 'auto'}
        accessibilityElementsHidden={formBusy || !formReady}
        importantForAccessibility={formBusy || !formReady ? 'no-hide-descendants' : 'auto'}
      >
        <AddDetailRow
          type={type}
          accountName={effectiveAccount?.name}
          date={date}
          today={today}
          yesterday={yesterday}
          note={note}
          noteEditing={noteEditing}
          isLinked={isLinked}
          refund={refund}
          splitCount={splitParts ? splitParts.length : null}
          hasList={rows.length > 0}
          onNoteChange={setNote}
          onNoteEditing={setNoteEditing}
          onPickAccount={() => setAccountSheetOpen(true)}
          onPickDate={() => setCalendarOpen(true)}
          onToggleRefund={() => {
            setRefund((r) => !r);
            setError(null);
          }}
          onSplit={openSplit}
          onHidePad={padVisible ? () => setPadOpen(false) : undefined}
        />
      </View>
      {padVisible ? (
        <AmountPad onKey={onPadKey} onClear={clearAmount} tone={padTone}>
          {addToListButton}
          {saveButton}
        </AmountPad>
      ) : (
        <View style={styles.actionRow}>
          {addToListButton}
          {saveButton}
        </View>
      )}
    </KeyboardStickyView>
  );
}
