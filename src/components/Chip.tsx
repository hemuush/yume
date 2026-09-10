import { Pressable, Text, StyleSheet } from 'react-native';
import { theme } from '@/constants/theme';

interface Props {
  label: string;
  active: boolean;
  onPress: () => void;
  /** When set, the active chip tints to this colour (used for category chips). */
  activeBorderColor?: string;
}

// The selectable pill used for account/category/type pickers across every
// "Add ___" modal — one accent-aware component instead of four copy-pastes.
export function Chip({ label, active, onPress, activeBorderColor }: Props) {
  const tinted = active && activeBorderColor;
  return (
    <Pressable
      style={[
        styles.chip,
        active && !tinted && styles.chipActive,
        tinted && { backgroundColor: activeBorderColor + '1A', borderColor: activeBorderColor },
      ]}
      onPress={onPress}
    >
      <Text style={[styles.text, active && styles.textActive]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    paddingHorizontal: 13,
    paddingVertical: 7,
    borderRadius: theme.radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.borderSoft,
    backgroundColor: theme.colors.surface,
  },
  chipActive: {
    backgroundColor: theme.colors.primaryTint,
    borderColor: theme.colors.secondary,
  },
  text: { fontSize: 12.5, color: theme.colors.textSecondary, fontFamily: theme.font.roundedMedium },
  textActive: { color: theme.colors.textPrimary, fontFamily: theme.font.roundedBold },
});
