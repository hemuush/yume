import { View, StyleSheet } from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { theme } from '@/constants/theme';

interface Props {
  name: string;
  backgroundColor: string;
  size?: number;
  /** Defaults to ink, right for the pale tints Settings/Notifications use — pass a contrasting colour (e.g. onAccent) when the badge itself is a solid saturated fill instead. */
  iconColor?: string;
}

// The small 30x30 outlined icon badge used on every settings/notification
// row — was duplicated as an inline `rowIcon` View + Feather icon across
// settings.tsx and notification-settings.tsx with mismatched icon families.
export function SettingsRowIcon({ name, backgroundColor, size = 14, iconColor = theme.colors.ink }: Props) {
  return (
    <View style={[styles.badge, { backgroundColor }]}>
      <MaterialCommunityIcons name={name as any} size={size} color={iconColor} />
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    width: 30,
    height: 30,
    borderRadius: 9,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.borderSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
