import { View, Pressable } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { withPressedTint } from '@/lib/pressed';
import { useAccent } from '@/theme/AccentContext';
import { ExpenseLabelSheet } from './ExpenseLabelSheet';
import { TextInput } from '@/components/Text';
import { theme } from '@/constants/theme';
import { dateChipLabel, EntryType } from './addEntry';
import { DetailBar, DetailChip } from './AddFields';
import { styles } from './add.styles';

/**
 * Add's account/date controls and single text field: reusable labels for expenses, notes for other flows.
 * Add owns the stored value; the expense picker commits only a confirmed selection.
 */
export function AddDetailRow({
  type,
  accountName,
  date,
  today,
  yesterday,
  note,
  noteEditing,
  isLinked,
  refund,
  splitCount,
  hasList,
  onNoteChange,
  onNoteEditing,
  onPickAccount,
  onPickDate,
  onToggleRefund,
  onSplit,
  onHidePad,
}: {
  type: EntryType;
  /** The account the entry goes on (expense/income only); undefined when there isn't one yet. */
  accountName: string | undefined;
  date: string;
  today: string;
  yesterday: string;
  note: string;
  noteEditing: boolean;
  isLinked: boolean;
  refund: boolean;
  /** How many parts the payment is split into, or null when it isn't split. */
  splitCount: number | null;
  /** A list of entries is being built, which a split can't join. */
  hasList: boolean;
  onNoteChange: (note: string) => void;
  onNoteEditing: (editing: boolean) => void;
  onPickAccount: () => void;
  onPickDate: () => void;
  onToggleRefund: () => void;
  onSplit: () => void;
  /** The number pad is up: a button at the end of the row folds it away. */
  onHidePad?: () => void;
}) {
  const { accent } = useAccent();
  if (noteEditing && type !== 'expense') {
    return (
      <TextInput
        value={note}
        onChangeText={onNoteChange}
        placeholder="e.g. Lunch with team"
        placeholderTextColor={theme.colors.textMuted}
        style={styles.noteInput}
        autoFocus
        returnKeyType="done"
        onSubmitEditing={() => onNoteEditing(false)}
        onBlur={() => onNoteEditing(false)}
        accessibilityLabel="Note"
      />
    );
  }
  return (
    <>
      <View style={onHidePad ? styles.detailRow : undefined}>
        <DetailBar flush={!!onHidePad}>
          {(type === 'expense' || type === 'income') && accountName && (
            <DetailChip
              icon="credit-card"
              label={accountName}
              onPress={onPickAccount}
              accessibilityLabel={`Account, ${accountName}. Change`}
            />
          )}
          <DetailChip
            icon="calendar"
            label={date === today ? 'Today' : date === yesterday ? 'Yesterday' : dateChipLabel(date)}
            onPress={onPickDate}
            accessibilityLabel={`Date, ${dateChipLabel(date)}. Change`}
          />
          <DetailChip
            icon={type === 'expense' ? 'tag' : 'edit-3'}
            label={note.trim() || (type === 'expense' ? 'Label' : 'Note')}
            muted={!note.trim()}
            onPress={() => onNoteEditing(true)}
            accessibilityLabel={
              note.trim()
                ? `${type === 'expense' ? 'Label' : 'Note'}, ${note}. Edit`
                : type === 'expense'
                  ? 'Add a label'
                  : 'Add a note'
            }
          />
          {/* A purchase can be money back, or one payment across several categories, but not both. */}
          {type === 'expense' && !isLinked && (
            <DetailChip
              icon="corner-up-left"
              label="Money back"
              active={refund}
              disabled={splitCount !== null}
              onPress={onToggleRefund}
              accessibilityLabel="Money back (a refund)"
            />
          )}
          {/* Not alongside a list being built: a split is saved on its own. */}
          {type === 'expense' && !isLinked && (
            <DetailChip
              icon="scissors"
              label={splitCount !== null ? `Split · ${splitCount}` : 'Split'}
              active={splitCount !== null}
              disabled={refund || hasList}
              onPress={onSplit}
              accessibilityLabel={
                splitCount !== null ? `Split into ${splitCount} parts. Edit` : 'Split this payment'
              }
            />
          )}
        </DetailBar>
        {onHidePad && (
          <Pressable
            onPress={onHidePad}
            style={withPressedTint(accent, styles.hidePadBtn)}
            hitSlop={4}
            accessibilityRole="button"
            accessibilityLabel="Hide pad"
          >
            <Feather name="chevron-down" size={16} color={theme.colors.textSecondary} />
          </Pressable>
        )}
      </View>
      {type === 'expense' && (
        <ExpenseLabelSheet
          visible={noteEditing}
          value={note}
          onClose={() => onNoteEditing(false)}
          onPick={onNoteChange}
        />
      )}
    </>
  );
}
