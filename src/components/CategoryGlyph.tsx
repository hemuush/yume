import { StyleSheet } from 'react-native';
import { Text } from '@/components/Text';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import type { McIconName } from '@/components/iconName';
import { isEmojiIcon } from '@/lib/categoryIcon';
import { themedStyles } from '@/theme/themedStyles';

/**
 * A category's icon, drawn the one way every screen draws it: a built-in name as an icon in `color`, or the person's own
 * emoji as text. An emoji is the phone's own picture, so `color` does not change it; it is drawn slightly larger than a
 * line icon of the same `size` (an emoji fills its box, a line icon leaves room), and never grows with the phone's font
 * size, so a tile stays the size the design gave it.
 */
export function CategoryGlyph({ name, size, color }: { name: string; size: number; color: string }) {
  if (isEmojiIcon(name)) {
    const fontSize = Math.round(size * 1.1);
    return (
      <Text
        allowFontScaling={false}
        accessible={false}
        importantForAccessibility="no-hide-descendants"
        style={[styles.emoji, { fontSize, lineHeight: Math.round(fontSize * 1.25) }]}
      >
        {name}
      </Text>
    );
  }
  return <MaterialCommunityIcons name={outlineOf(name) as McIconName} size={size} color={color} />;
}

/** The line version of a built-in icon where the font has one (`home` → `home-outline`); the quiet look draws lines. */
function outlineOf(name: string): string {
  const glyphs = MaterialCommunityIcons.glyphMap as Record<string, number> | undefined;
  if (!glyphs || name.endsWith('-outline') || glyphs[`${name}-outline`] === undefined) return name;
  return `${name}-outline`;
}

const styles = themedStyles(() =>
  StyleSheet.create({
    emoji: { textAlign: 'center', includeFontPadding: false },
  })
);
