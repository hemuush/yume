import { ReactNode } from 'react';
import { StyleProp, ViewStyle } from 'react-native';
import Animated from 'react-native-reanimated';
import { ROW_LAYOUT, ROW_EXIT } from '@/lib/animation';

/**
 * One row in a list that moves (lib/animation.ts `ROW_LAYOUT`): its
 * neighbours slide when it arrives or leaves, and it fades out when removed.
 * Give it the row's stable key — the id, never the index — or the wrong
 * row animates.
 */
export function MovingRow({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <Animated.View layout={ROW_LAYOUT} exiting={ROW_EXIT} style={style}>
      {children}
    </Animated.View>
  );
}
