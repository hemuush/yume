import { PressableStateCallbackType, StyleProp, ViewStyle } from 'react-native';

/**
 * How a plain Pressable answers a finger: it dims while held. Cards, tiles and big buttons shrink instead
 * (usePressScale); rows, chips, links and small icon buttons use this so nothing tappable looks inert.
 */
export const PRESSED: ViewStyle = { opacity: 0.6 };

/** A Pressable `style` that adds the pressed dim to `style`. */
export function withPressed(style?: StyleProp<ViewStyle>) {
  return ({ pressed }: PressableStateCallbackType): StyleProp<ViewStyle> => [style, pressed && PRESSED];
}
