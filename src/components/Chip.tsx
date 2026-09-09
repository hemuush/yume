import { Pressable, Text, StyleSheet } from 'react-native';
import { theme } from '@/constants/theme';
import { useAccent } from '@/theme/AccentContext';

interface Props {
  label: string;
  active: boolean;
  onPress: () => void;
  activeBorderColor?: string;
}

// The selectable pill used for account/category/type pickers across every
// "Add ___" modal — was copy-pasted with hardcoded lime in 4 files; one
// accent-aware component instead.
export function Chip({ label, active, onPress, activeBorderColor }: Props) {
  const { accent } = useAccent();
  const borderColor = activeBorderColor ?? accent;
  return (
    <Pressable
      style={[styles.chip, active && { backgroundColor: borderColor + '22', borderColor }]}
      onPress={onPress}
    >
      <Text
        style={[styles.text, active && { color: theme.colors.textPrimary, fontFamily: theme.font.bodyBold }]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: theme.border.thin,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },
  text: { fontSize: 13, color: theme.colors.textSecondary, fontFamily: theme.font.bodyMedium },
});
