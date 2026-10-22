import { useEffect, useRef, useState } from 'react';
import { View, Pressable, StyleSheet, PanResponder, GestureResponderEvent, ViewInstance } from 'react-native';
import Animated, { FadeIn, ReduceMotion } from 'react-native-reanimated';
import { Text } from '@/components/Text';
import { theme } from '@/constants/theme';
import { spendHeatScale, hexToHsl } from '@/lib/color';
import { gridRows } from '@/lib/gridRows';
import { haptics } from '@/lib/haptics';
import { withPressed } from '@/lib/pressed';
import { BIG_DAY_FACTOR, HeatDay, HeatModel, heatDayLabel } from './reportsInsights';

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const CELL_GAP = 4;
const CELL_H = 40;
const HEAD_H = 22;
const LABEL_W = 34;
const DOT_H = 16;
const DOT_GAP = 3;

/**
 * Finger-over-grid: a horizontal drag across the heatmap picks the day under it as it goes, a tap is left to
 * the cells' own press. Takes the gesture only once it is clearly sideways, so the page still scrolls.
 * `locate` turns a point inside the grid into the day there.
 */
function useGridScrub(locate: (x: number, y: number) => string | null, onPick: (iso: string) => void) {
  const box = useRef<ViewInstance>(null);
  const origin = useRef<{ x: number; y: number } | null>(null);
  const last = useRef<string | null>(null);
  const latest = useRef({ locate, onPick });
  useEffect(() => {
    latest.current = { locate, onPick };
  });
  const pickAt = (pageX: number, pageY: number) => {
    const o = origin.current;
    if (!o) return;
    const iso = latest.current.locate(pageX - o.x, pageY - o.y);
    if (iso && iso !== last.current) {
      last.current = iso;
      haptics.tap();
      latest.current.onPick(iso);
    }
  };
  // The refs are only read in the handlers, later, on touch: the safe "latest ref" pattern.
  // eslint-disable-next-line react-hooks/refs
  const [responder] = useState(() =>
    PanResponder.create({
      onMoveShouldSetPanResponderCapture: (_e, g) => Math.abs(g.dx) > 8 && Math.abs(g.dx) > Math.abs(g.dy),
      onPanResponderGrant: (_e: GestureResponderEvent, g) => {
        last.current = null;
        box.current?.measure((_x, _y, _w, _h, pageX, pageY) => {
          origin.current = { x: pageX, y: pageY };
          pickAt(g.moveX, g.moveY);
        });
      },
      onPanResponderMove: (_e, g) => pickAt(g.moveX, g.moveY),
      onPanResponderTerminationRequest: () => false,
    })
  );
  return { box, handlers: responder.panHandlers };
}

/** Label colour per level: muted on an empty day, ink on the washes, ink or cream on the full colour. */
function useHeatColors(hue: string) {
  const scale = spendHeatScale(hue);
  const onTop = hexToHsl(hue)[2] > 55 ? theme.colors.ink : theme.colors.surface;
  return {
    scale,
    labels: [theme.colors.textMuted, theme.colors.ink, theme.colors.ink, theme.colors.ink, onTop],
  };
}

const enter = (delay: number) => FadeIn.duration(260).delay(delay).reduceMotion(ReduceMotion.System);

function CalendarHeat({
  model,
  selectedIso,
  onSelect,
  usualMinor,
  hue,
}: {
  model: Extract<HeatModel, { kind: 'calendar' }>;
  selectedIso: string | null;
  onSelect: (iso: string) => void;
  usualMinor: number;
  hue: string;
}) {
  const { scale, labels } = useHeatColors(hue);
  const [width, setWidth] = useState(0);
  const rows = gridRows(model.days, model.leadingPad, 7);
  const cellW = width / 7;
  const { box, handlers } = useGridScrub((x, y) => {
    if (width <= 0) return null;
    const col = Math.floor(x / cellW);
    const row = Math.floor((y - HEAD_H) / (CELL_H + CELL_GAP));
    if (col < 0 || col > 6 || row < 0 || row >= rows.length) return null;
    const d = rows[row][col];
    return d && !d.future ? d.iso : null;
  }, onSelect);
  const renderDay = (d: HeatDay, pos: number) => {
    const selected = d.iso === selectedIso;
    const big = usualMinor > 0 && d.minor > usualMinor * BIG_DAY_FACTOR;
    return (
      <Animated.View
        key={d.iso}
        entering={enter(Math.floor(pos / 7) * 45 + (pos % 7) * 22)}
        style={styles.slot}
      >
        <Pressable
          disabled={d.future}
          onPress={() => onSelect(d.iso)}
          accessibilityRole="button"
          accessibilityLabel={heatDayLabel(d)}
          accessibilityState={{ selected, disabled: d.future }}
          style={withPressed([
            styles.cell,
            d.level === 0 && styles.cellEmpty,
            d.future && styles.cellFuture,
            selected && styles.cellSelected,
            { backgroundColor: scale[d.level] },
          ])}
        >
          <Text style={[styles.cellLabel, d.level === 4 && styles.cellLabelTop, { color: labels[d.level] }]}>
            {d.day}
          </Text>
          {big && <View style={styles.bigDot} />}
          {d.today && <View style={styles.todayDot} />}
        </Pressable>
      </Animated.View>
    );
  };
  return (
    <View ref={box} onLayout={(e) => setWidth(e.nativeEvent.layout.width)} {...handlers}>
      <View style={styles.weekRow}>
        {WEEKDAYS.map((w, i) => (
          <Text key={i} style={[styles.slot, styles.weekday]}>
            {w}
          </Text>
        ))}
      </View>
      {rows.map((row, r) => (
        <View key={r} style={styles.weekRow}>
          {row.map((d, c) => (d ? renderDay(d, r * 7 + c) : <View key={`b${c}`} style={styles.slot} />))}
        </View>
      ))}
    </View>
  );
}

function MatrixHeat({
  model,
  selectedIso,
  onSelect,
  onOpenMonth,
  hue,
}: {
  model: Extract<HeatModel, { kind: 'matrix' }>;
  selectedIso: string | null;
  onSelect: (iso: string) => void;
  onOpenMonth?: (monthKey: string) => void;
  hue: string;
}) {
  const { scale } = useHeatColors(hue);
  const [width, setWidth] = useState(0);
  const colW = (width - LABEL_W) / 31;
  const { box, handlers } = useGridScrub((x, y) => {
    if (width <= 0) return null;
    const col = Math.floor((x - LABEL_W) / colW);
    const row = Math.floor(y / (DOT_H + DOT_GAP));
    if (col < 0 || col > 30 || row < 0 || row >= model.rows.length) return null;
    const d = model.rows[row].days[col];
    return d && !d.future ? d.iso : null;
  }, onSelect);
  const selectedMonth = selectedIso?.slice(0, 7);
  return (
    <View
      ref={box}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      {...handlers}
      style={styles.matrix}
    >
      {model.rows.map((row, r) => (
        <View key={row.key} style={styles.matrixRow}>
          <Pressable
            onPress={onOpenMonth ? () => onOpenMonth(row.key) : undefined}
            disabled={!onOpenMonth}
            hitSlop={{ top: 2, bottom: 2 }}
            accessibilityRole="button"
            accessibilityLabel={`Open ${row.label}`}
            style={styles.matrixLabelWrap}
          >
            <Text style={[styles.matrixLabel, row.key === selectedMonth && styles.matrixLabelOn]}>
              {row.label}
            </Text>
          </Pressable>
          {row.days.map((d, c) =>
            d ? (
              <Animated.View key={d.iso} entering={enter(r * 28 + c * 4)} style={styles.dotSlot}>
                <Pressable
                  disabled={d.future}
                  onPress={() => onSelect(d.iso)}
                  accessibilityRole="button"
                  accessibilityLabel={heatDayLabel(d)}
                  accessibilityState={{ selected: d.iso === selectedIso, disabled: d.future }}
                  style={[
                    styles.dot,
                    d.level === 0 && styles.cellEmpty,
                    d.future && styles.dotFuture,
                    d.iso === selectedIso && styles.dotSelected,
                    { backgroundColor: scale[d.level] },
                  ]}
                />
              </Animated.View>
            ) : (
              <View key={`x${c}`} style={styles.dotSlot} />
            )
          )}
        </View>
      ))}
    </View>
  );
}

/**
 * The spend heatmap. A month or two is a calendar tinted by daily spend, with a dot on days far above the
 * usual; a longer period is a
 * month × day-of-month matrix. Tap a day, or drag across the grid to read them in turn.
 */
export function SpendHeatmap({
  model,
  selectedIso,
  onSelect,
  onOpenMonth,
  usualMinor,
  hue,
}: {
  model: HeatModel;
  selectedIso: string | null;
  onSelect: (iso: string) => void;
  onOpenMonth?: (monthKey: string) => void;
  usualMinor: number;
  hue: string;
}) {
  return model.kind === 'calendar' ? (
    <CalendarHeat
      model={model}
      selectedIso={selectedIso}
      onSelect={onSelect}
      usualMinor={usualMinor}
      hue={hue}
    />
  ) : (
    <MatrixHeat
      model={model}
      selectedIso={selectedIso}
      onSelect={onSelect}
      onOpenMonth={onOpenMonth}
      hue={hue}
    />
  );
}

const styles = StyleSheet.create({
  weekRow: { flexDirection: 'row', alignItems: 'center', marginBottom: CELL_GAP },
  slot: { flex: 1, minWidth: 0, paddingHorizontal: 2 },
  weekday: {
    height: HEAD_H - CELL_GAP,
    textAlign: 'center',
    fontFamily: theme.font.body,
    fontSize: 11,
    color: theme.colors.textMuted,
  },
  cell: { height: CELL_H, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  cellEmpty: { borderWidth: StyleSheet.hairlineWidth, borderColor: theme.colors.borderSoft },
  cellFuture: { borderWidth: 0, opacity: 0.35 },
  cellSelected: { borderWidth: 2.5, borderColor: theme.colors.ink },
  cellLabel: { fontFamily: theme.font.body, fontSize: 12 },
  cellLabelTop: { fontFamily: theme.font.bodyBold },
  todayDot: {
    position: 'absolute',
    bottom: 4,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: theme.colors.ink,
  },
  bigDot: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: theme.colors.ink,
  },
  matrix: { gap: DOT_GAP },
  matrixRow: { flexDirection: 'row', alignItems: 'center', height: DOT_H },
  matrixLabelWrap: { width: LABEL_W, justifyContent: 'center', height: DOT_H },
  matrixLabel: { fontFamily: theme.font.body, fontSize: 11, color: theme.colors.textMuted },
  matrixLabelOn: { fontFamily: theme.font.bodyBold, color: theme.colors.textPrimary },
  dotSlot: { flex: 1, minWidth: 0, paddingHorizontal: 1 },
  dot: { height: DOT_H, borderRadius: 4 },
  dotFuture: { borderWidth: 0, opacity: 0.35 },
  dotSelected: { borderWidth: 1.5, borderColor: theme.colors.ink },
});
