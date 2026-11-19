import { StyleSheet, View } from 'react-native';
import { AddButton } from '@/components/AddButton';
import { PrimaryButton } from '@/components/PrimaryButton';
import { themedStyles } from '@/theme/themedStyles';

export function WorkspaceActions({
  onAdd,
  addLabel,
  disabled,
  onToggle,
  toggleLabel,
}: {
  onAdd?: () => void;
  addLabel?: string;
  disabled?: boolean;
  onToggle?: () => void;
  toggleLabel?: string;
}) {
  if (!onAdd && !onToggle) return null;
  return (
    <View style={styles.row}>
      {onToggle && toggleLabel && (
        <PrimaryButton compact variant="secondary" title={toggleLabel} onPress={onToggle} />
      )}
      {onAdd && <AddButton onPress={onAdd} label={addLabel} disabled={disabled} />}
    </View>
  );
}

const styles = themedStyles(() =>
  StyleSheet.create({
    row: {
      marginHorizontal: 16,
      minHeight: 44,
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'flex-end',
      alignItems: 'center',
      gap: 8,
    },
  })
);
