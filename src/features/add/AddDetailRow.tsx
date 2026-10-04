import { TextInput } from '@/components/Text';
import { theme } from '@/constants/theme';
import { dateChipLabel, EntryType } from './addEntry';
import { DetailBar, DetailChip } from './AddFields';
import { styles } from './add.styles';

/**
 * What sits above Add's pad: the note field while it is being typed, otherwise the detail bar of account,
 * date, note, and for a purchase Money back and Split. Shows state and reports taps; Add owns the state.
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
}) {
  if (noteEditing) {
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
    <DetailBar>
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
        icon="edit-3"
        label={note.trim() || 'Note'}
        muted={!note.trim()}
        onPress={() => onNoteEditing(true)}
        accessibilityLabel={note.trim() ? `Note, ${note}. Edit` : 'Add a note'}
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
  );
}
