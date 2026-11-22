import { View, StyleSheet } from 'react-native';
import { theme } from '@/constants/theme';
import { CategoryGlyph } from '@/components/CategoryGlyph';
import { categoryTone } from '@/lib/categoryTone';
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

// A category's icon on a pale wash of its own colour with the glyph in a deep shade of it (see categoryTone), so categories read
// apart in a list. An emoji sits on the same wash (its own colours are the phone's). A colour that is not a hex value keeps the quiet neutral tile.
export function CategoryIcon({ name, color, size = 16, square = 34, round = false, ledgerStyle }: Props) {
  const tone = categoryTone(color);
  return (
    <View
      style={[
        styles.chip,
        {
          width: square,
          height: square,
          borderRadius: round ? square / 2 : square * 0.32,
          backgroundColor: tone
            ? tone.fill
            : ledgerStyle
              ? theme.colors.home.control
              : theme.colors.surfaceAlt,
        },
      ]}
    >
      <CategoryGlyph name={name} size={size} color={tone ? tone.glyph : theme.colors.ink} />
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
