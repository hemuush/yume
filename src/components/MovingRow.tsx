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
export function MovingRow({
  children,
  style,
  moving = true,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  /** False for a moment after rows were moved by hand, so they land without sliding twice. */
  moving?: boolean;
}) {
  return (
    <Animated.View layout={moving ? ROW_LAYOUT : undefined} exiting={ROW_EXIT} style={style}>
      {children}
    </Animated.View>
  );
}
