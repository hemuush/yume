import { useEffect, useRef } from 'react';

/** The part of a list this needs: any FlatList or ScrollView ref has it. */
type OffsetScroller = { scrollToOffset: (params: { offset: number; animated?: boolean }) => void };

/**
 * Puts a list back at its top when `key` changes (the period it shows, the tab it is on). A list keeps its scroll
 * offset when its data is replaced, so without this a new period opens wherever the last one was scrolled to:
 * pick another month from the shrunk header and you land mid-way down it, or at its end, with the summary
 * scrolled out of view. The same key again (a reload of what is shown) leaves the list where it is.
 */
export function useScrollToTopOnChange(ref: { current: OffsetScroller | null }, key: string) {
  const shown = useRef(key);
  useEffect(() => {
    if (shown.current === key) return;
    shown.current = key;
    ref.current?.scrollToOffset({ offset: 0, animated: false });
  }, [key, ref]);
}
