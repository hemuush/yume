import { View, StyleSheet } from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { theme } from '@/constants/theme';
import { useAccent } from '@/theme/AccentContext';
import type { McIconName } from '@/components/iconName';
import { softTint } from '@/components/softTint';

interface Props {
  name: string;
  color?: string;
  size?: number;
  square?: number;
  /** A circle instead of a rounded square — Home's rows (the Home A sign-off). */
  round?: boolean;
}

// A category's icon in a soft, borderless tinted square, matching the calm hairline register
// (SoftCard, Home hero), not the older thick-ink outline.
export function CategoryIcon({ name, color, size = 17, square = 38, round = false }: Props) {
  const { accent } = useAccent();
  const resolvedColor = color ?? accent;
  return (
    <View
      style={[
        styles.chip,
        {
          width: square,
          height: square,
          borderRadius: round ? square / 2 : square * 0.32,
          backgroundColor: softTint(resolvedColor, 0.25),
        },
      ]}
    >
      <MaterialCommunityIcons name={name as McIconName} size={size} color={theme.colors.ink} />
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
