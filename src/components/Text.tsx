import { ComponentPropsWithRef } from 'react';
import { StyleSheet, Text as RNText, TextInput as RNTextInput } from 'react-native';
import { theme } from '@/constants/theme';
import { useFontScale } from '@/lib/useFontScale';

/**
 * Supported text scale. Enlarged labels wrap and controls grow instead of forcing text into a 130% tile.
 */
export const MAX_FONT_SCALE = theme.accessibility.maxFontScale;

function numeric(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

/**
 * React Native's Text with Yume's font-scale limit. Screens import Text from here, not 'react-native'
 * (enforced by src/__tests__/fontScale.test.ts); a caller can still pass its own `maxFontSizeMultiplier`.
 */
export function Text(props: ComponentPropsWithRef<typeof RNText>) {
  const reflow = useFontScale() > theme.accessibility.reflowFontScale;
  return (
    <RNText
      maxFontSizeMultiplier={MAX_FONT_SCALE}
      {...props}
      numberOfLines={reflow && props.numberOfLines === 1 ? undefined : props.numberOfLines}
      adjustsFontSizeToFit={reflow ? false : props.adjustsFontSizeToFit}
    />
  );
}

/** React Native's TextInput with the same font-scale limit as Text. */
export function TextInput(props: ComponentPropsWithRef<typeof RNTextInput>) {
  const fontScale = useFontScale();
  const style = StyleSheet.flatten(props.style);
  const lineHeight =
    style?.lineHeight ?? (style?.fontSize ?? theme.typeSize.row) * theme.accessibility.lineHeightRatio;
  const verticalPadding = numeric(style?.paddingVertical, numeric(style?.padding, theme.space.sm));
  const padding =
    numeric(style?.paddingTop, verticalPadding) + numeric(style?.paddingBottom, verticalPadding);
  const border =
    numeric(style?.borderTopWidth, numeric(style?.borderWidth, 0)) +
    numeric(style?.borderBottomWidth, numeric(style?.borderWidth, 0));
  return (
    <RNTextInput
      maxFontSizeMultiplier={MAX_FONT_SCALE}
      {...props}
      style={[
        props.style,
        fontScale > theme.accessibility.reflowFontScale && {
          minHeight: Math.max(
            numeric(style?.minHeight, 0),
            Math.ceil(lineHeight * Math.min(fontScale, MAX_FONT_SCALE) + padding + border)
          ),
        },
      ]}
    />
  );
}
