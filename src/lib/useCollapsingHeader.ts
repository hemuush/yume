import { Component, useCallback, useMemo, useState } from 'react';
import {
  useAnimatedRef,
  useAnimatedScrollHandler,
  useSharedValue,
  SharedValue,
} from 'react-native-reanimated';
import type Animated from 'react-native-reanimated';

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
 * The header follows the scroll offset without issuing a second scroll after the finger lifts.
 */
export function useCollapsingHeader<T extends Component = Animated.ScrollView>() {
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

  // Scroll events are throttled, so the last one before the list comes to rest can be a few points short of
  // where it stopped. Reading the final offset again when the finger lifts and when the momentum ends keeps the
  // header in step with the list: a list left at its top always reads 0, never a stale "a little scrolled" that
  // leaves the controls under the title half faded. This only records the offset; it never scrolls or snaps.
  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (e) => {
      scrollY.value = e.contentOffset.y;
    },
    onEndDrag: (e) => {
      scrollY.value = e.contentOffset.y;
    },
    onMomentumEnd: (e) => {
      scrollY.value = e.contentOffset.y;
    },
  });

  // Keyboard-aware views also track their offset in JS; keep their existing scroll handler intact.
  const onJsScroll = useCallback((y: number) => scrollY.set(y), [scrollY]);

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
  };
}
