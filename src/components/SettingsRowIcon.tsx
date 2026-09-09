import { View, StyleSheet } from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { theme } from '@/constants/theme';

interface Props {
  name: string;
  backgroundColor: string;
  size?: number;
}

// The small 30x30 outlined icon badge used on every settings/notification
// row — was duplicated as an inline `rowIcon` View + Feather icon across
// settings.tsx and notification-settings.tsx with mismatched icon families.
export function SettingsRowIcon({ name, backgroundColor, size = 14 }: Props) {
  return (
    <View style={[styles.badge, { backgroundColor }]}>
      <MaterialCommunityIcons name={name as any} size={size} color={theme.colors.ink} />
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    width: 30,
    height: 30,
    borderRadius: 9,
    borderWidth: theme.border.thin,
    borderColor: theme.colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
