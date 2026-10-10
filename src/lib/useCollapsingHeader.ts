import { Component, useCallback, useMemo, useState } from 'react';
import {
  useAnimatedRef,
  useAnimatedScrollHandler,
  useSharedValue,
  scrollTo,
  SharedValue,
} from 'react-native-reanimated';
import type Animated from 'react-native-reanimated';
import { useReduceMotion } from './useReduceMotion';

/** How fast a release must be (px/ms) to count as a fling, which carries on and settles by itself. */
const FLING = 0.2;

/** What SkyHeader needs to follow the list: pass it as `collapse`. */
export interface CollapsingHeader {
  /** The list's vertical offset, which drives the header. */
  scrollY: SharedValue<number>;
  /** How far the header collapses (measured by SkyHeader): the scroll over which it shrinks. */
  distance: SharedValue<number>;
  /** SkyHeader reports its full height and how far it can collapse. */
  onMeasure: (height: number, distance: number) => void;
}

/**
 * The shared scroll wiring for a screen whose SkyHeader shrinks as it scrolls: pass `scrollHandler` and
 * `scrollRef` to the screen's Animated.ScrollView (or FlatList), pad its content by `headerHeight`, and pass
 * `collapse` to SkyHeader. `collapsedHeight` is how much of the page the shrunk header covers, for jumps.
 * Let go part-way through the shrink and the list settles to fully open or fully closed, so the header never
 * rests half-shrunk.
 */
export function useCollapsingHeader<T extends Component = Animated.ScrollView>() {
  const reduce = useReduceMotion();
  const scrollY = useSharedValue(0);
  const distance = useSharedValue(0);
  // A ScrollView's by default; a FlatList screen names its own list type.
  const scrollRef = useAnimatedRef<T>();
  const [headerHeight, setHeaderHeight] = useState(0);
  const [collapsedHeight, setCollapsedHeight] = useState(0);
  const onMeasure = useCallback(
    (h: number, d: number) => {
      distance.set(d);
      setHeaderHeight(h);
      setCollapsedHeight(h - d);
    },
    [distance]
  );

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (e) => {
      scrollY.value = e.contentOffset.y;
    },
    onEndDrag: (e) => {
      const velocity = e.velocity?.y;
      const y = e.contentOffset.y;
      const d = distance.value;
      // Some Android releases omit velocity here. Treating that as zero interrupts an active fling;
      // wait for momentum end instead of issuing a competing programmatic scroll.
      if (velocity != null && Math.abs(velocity) < FLING && d > 0 && y > 0 && y < d)
        scrollTo(scrollRef, 0, y < d / 2 ? 0 : d, !reduce);
    },
    onMomentumEnd: (e) => {
      const y = e.contentOffset.y;
      const d = distance.value;
      if (d > 0 && y > 0 && y < d) scrollTo(scrollRef, 0, y < d / 2 ? 0 : d, !reduce);
    },
  });

  // For a scroll view that already tracks its own offset in JS (the amount pad's, on Profile and the Garden):
  // feed the header from its onScroll, and settle it from its drag and momentum ends.
  const onJsScroll = useCallback((y: number) => scrollY.set(y), [scrollY]);
  const settleJs = useCallback(
    (y: number, scrollToY: (y: number) => void) => {
      const d = distance.get();
      if (d > 0 && y > 0 && y < d) scrollToY(y < d / 2 ? 0 : d);
    },
    [distance]
  );

  // A list that remounts (a new key) starts at its top without a scroll event: open the header with it.
  const resetScroll = useCallback(() => scrollY.set(0), [scrollY]);

  const collapse: CollapsingHeader = useMemo(
    () => ({ scrollY, distance, onMeasure }),
    [scrollY, distance, onMeasure]
  );
  return {
    collapse,
    headerHeight,
    collapsedHeight,
    scrollHandler,
    scrollRef,
    resetScroll,
    onJsScroll,
    settleJs,
  };
}
