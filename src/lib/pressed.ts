import { PressableStateCallbackType, StyleProp, ViewStyle } from 'react-native';

/**
 * How a plain Pressable answers a finger: it dims while held. Cards, tiles
 * and the big buttons shrink slightly instead (usePressScale); everything
 * else — rows, chips, links, small icon buttons — uses this, so nothing you
 * can tap sits there looking inert.
 */
export const PRESSED: ViewStyle = { opacity: 0.6 };

/** A Pressable `style` that adds the pressed dim to `style`. */
export function withPressed(style?: StyleProp<ViewStyle>) {
  return ({ pressed }: PressableStateCallbackType): StyleProp<ViewStyle> => [style, pressed && PRESSED];
}
