import { View, StyleSheet } from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { theme } from '@/constants/theme';
import { useAccent } from '@/theme/AccentContext';

interface Props {
  name: string;
  color?: string;
  size?: number;
  square?: number;
}

// Renders a category's icon inside a soft, borderless tinted square — matches
// the calm hairline register (SoftCard, the Home hero) rather than the older
// thick-ink outline.
export function CategoryIcon({ name, color, size = 17, square = 38 }: Props) {
  const { accent } = useAccent();
  const resolvedColor = color ?? accent;
  return (
    <View
      style={[
        styles.chip,
        { width: square, height: square, borderRadius: square * 0.32, backgroundColor: resolvedColor + '40' },
      ]}
    >
      <MaterialCommunityIcons name={name as any} size={size} color={theme.colors.ink} />
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
