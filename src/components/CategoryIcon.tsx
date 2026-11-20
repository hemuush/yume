import { View, StyleSheet } from 'react-native';
import { theme } from '@/constants/theme';
import { CategoryGlyph } from '@/components/CategoryGlyph';
import { themedStyles } from '@/theme/themedStyles';

interface Props {
  name: string;
  color?: string;
  size?: number;
  square?: number;
  /** A circle instead of a rounded square — Home's rows (the Home A sign-off). */
  round?: boolean;
  ledgerStyle?: boolean;
}

// A category's icon in a quiet neutral disc: the colour belongs to the category in the charts and bars, not to every
// row of a list. `color` is kept so callers need not change; it no longer tints the disc.
export function CategoryIcon({ name, size = 16, square = 34, round = false, ledgerStyle }: Props) {
  return (
    <View
      style={[
        styles.chip,
        {
          width: square,
          height: square,
          borderRadius: round ? square / 2 : square * 0.32,
          backgroundColor: ledgerStyle ? theme.colors.home.control : theme.colors.surfaceAlt,
        },
      ]}
    >
      <CategoryGlyph name={name} size={size} color={theme.colors.ink} />
    </View>
  );
}

const styles = themedStyles(() =>
  StyleSheet.create({
    chip: {
      alignItems: 'center',
      justifyContent: 'center',
    },
  })
);
