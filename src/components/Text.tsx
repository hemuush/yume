import { ComponentPropsWithRef } from 'react';
import { Text as RNText, TextInput as RNTextInput } from 'react-native';

/**
 * How far text follows the phone's font-size setting. Up to "Large" (130%) every screen keeps its shape;
 * past that fixed-size tiles and cards cut text off, so larger settings are capped at 130%.
 */
export const MAX_FONT_SCALE = 1.3;

/**
 * React Native's Text with Yume's font-scale limit. Screens import Text from here, not 'react-native'
 * (enforced by src/__tests__/fontScale.test.ts); a caller can still pass its own `maxFontSizeMultiplier`.
 */
export function Text(props: ComponentPropsWithRef<typeof RNText>) {
  return <RNText maxFontSizeMultiplier={MAX_FONT_SCALE} {...props} />;
}

/** React Native's TextInput with the same font-scale limit as Text. */
export function TextInput(props: ComponentPropsWithRef<typeof RNTextInput>) {
  return <RNTextInput maxFontSizeMultiplier={MAX_FONT_SCALE} {...props} />;
}
