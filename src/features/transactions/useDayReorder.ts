import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated } from 'react-native';
import { haptics } from '@/lib/haptics';
import type { Transaction } from '@/types';
import { dropIndex, laneKey, laneOrderIds, moveLine, type LaneLine } from './transactions.helpers';
import { ROW_H } from './TimelineDay.styles';

/**
 * Hand-ordering of one Activity day: hold a line to lift it, drag it, let go (or Move up / Move down for TalkBack and
 * switch access). `shown` is the order to draw: the new one straight away, until the reloaded entries carry it
 * themselves. It remembers the entries it was arranged from, so once they reload it no longer applies, with no reset
 * effect (and its extra render) needed.
 */
export function useDayReorder({
  items,
  date,
  lines,
  transfers,
  onReorder,
  onDragActive,
}: {
  items: Transaction[];
  date: string;
  lines: LaneLine[];
  transfers: Transaction[];
  /** Saves the day's new order. Omit to turn hand-ordering off (search, filters). */
  onReorder?: (date: string, orderedIds: string[]) => Promise<void>;
  /** True while a line is held and dragged, so the list can stop scrolling under the finger. */
  onDragActive?: (active: boolean) => void;
}) {
  const [arrangedState, setArrangedState] = useState<{ from: Transaction[]; lines: LaneLine[] } | null>(null);
  const arranged = arrangedState && arrangedState.from === items ? arrangedState.lines : null;
  const setArranged = useCallback(
    (next: LaneLine[] | null) => setArrangedState(next ? { from: items, lines: next } : null),
    [items]
  );
  const [dragState, setDrag] = useState<{
    from: number;
    to: number;
    height: number;
    items: Transaction[];
  } | null>(null);
  const drag = dragState?.items === items && onReorder ? dragState : null;
  const [settlingItems, setSettlingItems] = useState<Transaction[] | null>(null);
  const settling = settlingItems === items;
  const reorderSeq = useRef({ value: 0 });
  const dragRef = useRef<{ from: number; to: number; height: number } | null>(null);
  const heights = useRef(new Map<string, number>());
  const [dy] = useState(() => new Animated.Value(0));
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    const generation = reorderSeq.current;
    // Reloading/filtering a held day must release the screen's scroll lock as well.
    return () => {
      generation.value++;
      if (settleTimer.current) clearTimeout(settleTimer.current);
      if (dragRef.current) onDragActive?.(false);
      dragRef.current = null;
      dy.stopAnimation();
    };
  }, [items, onReorder, onDragActive, dy]);
  const shown = arranged ?? lines;
  const canReorder = !!onReorder && shown.length > 1;

  const heightsInOrder = () => shown.map((l) => heights.current.get(laneKey(l)) ?? ROW_H);
  const lift = (index: number) => {
    haptics.tap();
    dy.setValue(0);
    dragRef.current = { from: index, to: index, height: heights.current.get(laneKey(shown[index])) ?? ROW_H };
    setDrag({ ...dragRef.current, items });
    onDragActive?.(true);
  };
  const moveTo = (offset: number) => {
    const cur = dragRef.current;
    if (!cur) return;
    const to = dropIndex(heightsInOrder(), cur.from, offset);
    if (to === cur.to) return;
    haptics.tap();
    dragRef.current = { ...cur, to };
    setDrag({ ...dragRef.current, items });
  };
  const reorder = useCallback(
    async (next: LaneLine[]) => {
      const seq = ++reorderSeq.current.value;
      setSettlingItems(items);
      setArranged(next);
      if (settleTimer.current) clearTimeout(settleTimer.current);
      settleTimer.current = setTimeout(() => {
        if (seq === reorderSeq.current.value) setSettlingItems(null);
      }, 150);
      try {
        await onReorder?.(date, laneOrderIds(next, transfers));
      } catch {
        if (seq !== reorderSeq.current.value) return;
        haptics.warn();
        setArranged(null);
      }
    },
    [onReorder, date, transfers, setArranged, items]
  );
  const drop = () => {
    const cur = dragRef.current;
    if (!cur) return;
    dragRef.current = null;
    setDrag(null);
    dy.setValue(0);
    onDragActive?.(false);
    if (cur.to !== cur.from) {
      // Lift and each place passed over tick; landing in a new place confirms, so the drop is felt as well as seen.
      haptics.confirm();
      void reorder(moveLine(shown, cur.from, cur.to));
    }
  };
  // Move up / move down, for TalkBack and switch access, where dragging isn't possible.
  const a11yMove = (index: number, by: -1 | 1) => {
    const to = index + by;
    if (to < 0 || to >= shown.length) return;
    haptics.tap();
    void reorder(moveLine(shown, index, to));
  };
  const reorderProps = (index: number) =>
    canReorder
      ? {
          onLongPress: () => lift(index),
          delayLongPress: 350,
          accessibilityActions: [
            { name: 'moveUp', label: 'Move up' },
            { name: 'moveDown', label: 'Move down' },
          ],
          onAccessibilityAction: (e: { nativeEvent: { actionName: string } }) =>
            a11yMove(index, e.nativeEvent.actionName === 'moveUp' ? -1 : 1),
        }
      : {};
  // How far line `i` makes room for the lifted one.
  const shiftOf = (i: number) => {
    if (!drag || i === drag.from) return 0;
    if (drag.from < drag.to && i > drag.from && i <= drag.to) return -drag.height;
    if (drag.from > drag.to && i >= drag.to && i < drag.from) return drag.height;
    return 0;
  };

  return {
    shown,
    /** Just after a hand-ordering: the lines have been moved already and must not slide a second time. */
    settling,
    /** The index of the line held, or null. */
    liftedIndex: drag ? drag.from : null,
    dy,
    shiftOf,
    reorderProps,
    /** A line reports its height, which sets how far the others make room and where a drop lands. */
    rememberHeight: (line: LaneLine, height: number) => heights.current.set(laneKey(line), height),
    moveTo,
    drop,
  };
}
