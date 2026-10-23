import { View, StyleSheet } from 'react-native';
import { Text } from '@/components/Text';
import { ToggleSwitch } from '@/components/ToggleSwitch';
import { theme } from '@/constants/theme';

/** A yes/no setting as one row: what it is, a line saying what it does, the switch on the right. */
export function SwitchRow({
  title,
  hint,
  value,
  onChange,
  disabled,
}: {
  title: string;
  hint: string;
  value: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <View style={styles.row}>
      <View style={styles.copy}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.hint}>{hint}</Text>
      </View>
      <ToggleSwitch value={value} onChange={onChange} accessibilityLabel={title} disabled={disabled} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 12,
    borderRadius: 18,
    backgroundColor: theme.colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.borderSoft,
  },
  copy: { flex: 1, minWidth: 0 },
  title: { fontFamily: theme.font.bodyMedium, fontSize: 14, color: theme.colors.textPrimary },
  hint: { fontFamily: theme.font.body, fontSize: 12, lineHeight: 17, color: theme.colors.textMuted },
});
