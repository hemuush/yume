import { ComponentPropsWithRef } from 'react';
import { Text as RNText, TextInput as RNTextInput } from 'react-native';

/**
 * How far text follows the phone's own font-size setting (Android Settings →
 * Display → Font size). Up to "Large" (130%) every screen keeps its shape;
 * past that, fixed-size tiles and cards start cutting text off, so larger
 * settings show at 130%. Signed off as "option A" of the text-size design.
 */
export const MAX_FONT_SCALE = 1.3;

/**
 * React Native's Text with Yume's font-scale limit. Every screen imports
 * Text from here, not from 'react-native' — src/__tests__/fontScale.test.ts
 * enforces it. A caller can still pass its own `maxFontSizeMultiplier`.
 */
export function Text(props: ComponentPropsWithRef<typeof RNText>) {
  return <RNText maxFontSizeMultiplier={MAX_FONT_SCALE} {...props} />;
}

/** React Native's TextInput with the same font-scale limit as Text. */
export function TextInput(props: ComponentPropsWithRef<typeof RNTextInput>) {
  return <RNTextInput maxFontSizeMultiplier={MAX_FONT_SCALE} {...props} />;
}
