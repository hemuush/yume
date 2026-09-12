import { View, StyleSheet } from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { theme } from '@/constants/theme';

interface Props {
  name: string;
  size?: number;
  /** Defaults to ink — pass a real colour (e.g. the user's accent) where the badge itself should carry meaning, like AccountChip's per-type colouring. */
  backgroundColor?: string;
}

// A small circle with a white icon — sits on top of a flat colored card
// (never tinted to match it), the way the reference cards badge their icon
// in a solid circle for contrast against the bright fill.
export function FlatIconBadge({ name, size = 30, backgroundColor = theme.colors.onFlat }: Props) {
  return (
    <View style={[styles.badge, { width: size, height: size, borderRadius: size / 2, backgroundColor }]}>
      <MaterialCommunityIcons name={name as any} size={size * 0.55} color={theme.colors.white} />
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { alignItems: 'center', justifyContent: 'center' },
});
