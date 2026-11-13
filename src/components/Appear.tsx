import { ReactNode } from 'react';
import { StyleProp, ViewStyle } from 'react-native';
import Animated from 'react-native-reanimated';
import { CONTENT_ENTER, ROW_EXIT, ROW_LAYOUT } from '@/lib/animation';

/**
 * A block that comes and goes while its screen is open (an error banner, a notice, a status line): it fades in on
 * the shared short fade, fades out on the shared exit, and if its place moves because something above it came or
 * went, it slides there instead of jumping. All three are off with the phone's reduce-motion setting.
 * Put it where a plain `{cond && <View>…</View>}` would be.
 */
export function Appear({
  children,
  style,
  accessibilityLiveRegion,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  accessibilityLiveRegion?: 'none' | 'polite' | 'assertive';
}) {
  return (
    <Animated.View
      entering={CONTENT_ENTER}
      exiting={ROW_EXIT}
      layout={ROW_LAYOUT}
      style={style}
      accessibilityLiveRegion={accessibilityLiveRegion}
    >
      {children}
    </Animated.View>
  );
}
