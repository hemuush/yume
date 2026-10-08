import { useEffect, useState } from 'react';
import { View, Pressable, ScrollView, StyleSheet } from 'react-native';
import { Text } from '@/components/Text';
import { ModalSheet } from '@/components/ModalSheet';
import { theme } from '@/constants/theme';
import { getSpendByMonth } from '@/db/reports';
import { getCurrencySymbol } from '@/lib/money';
import { longMonth, shortMonth } from '@/lib/dateLabels';
import { haptics } from '@/lib/haptics';
import { withPressed } from '@/lib/pressed';
import { usePrivacy } from '@/theme/PrivacyContext';
import { useAccent } from '@/theme/AccentContext';
import { homeInk } from '@/features/home/homeInk';

export interface PickedPeriod {
  kind: 'month' | 'year';
  year: number;
  /** 0-11; ignored for a year. */
  month: number;
}

const iso = (year: number, month: number, day = 1) =>
  `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
const monthKey = (year: number, month: number) => iso(year, month).slice(0, 7);

/** "₹850", "₹61k", "₹1.2L": a month's spend small enough to sit under its name. */
export function compactMoney(minor: number): string {
  const sym = getCurrencySymbol();
  const major = Math.round(minor / 100);
  if (major < 1000) return `${sym}${major}`;
  if (major < 100000) {
    const k = major / 1000;
    return `${sym}${k < 10 ? k.toFixed(1).replace(/\.0$/, '') : Math.round(k)}k`;
  }
  return `${sym}${(major / 100000).toFixed(1).replace(/\.0$/, '')}L`;
}

/**
 * The period picker, one sheet for Home and Activity: Month | Year (Year only where the screen has a year
 * view), the years as chips, the twelve months in a grid with what each cost, and a button back to now.
 * Future months, and months before the first entry, are faded and can't be picked. One tap picks and closes.
 * `weeks` adds the shown month's weeks as chips (Activity's week view).
 */
export function PeriodPicker({
  visible,
  onClose,
  today,
  selected,
  allowYear = false,
  onPickMonth,
  onPickYear,
  onCurrent,
  weeks,
}: {
  visible: boolean;
  onClose: () => void;
  today: Date;
  selected: PickedPeriod;
  allowYear?: boolean;
  onPickMonth: (year: number, month: number) => void;
  onPickYear?: (year: number) => void;
  /** "This month" / "This year". */
  onCurrent: (kind: 'month' | 'year') => void;
  weeks?: {
    /** "October" */
    monthLabel: string;
    ranges: { start: string; end: string }[];
    /** The week being viewed, if the week view is on. */
    index: number | null;
    onPick: (start: string) => void;
  };
}) {
  const { hideAmounts } = usePrivacy();
  const { accent } = useAccent();
  const ink = homeInk(accent);
  const [mode, setMode] = useState<'month' | 'year'>(selected.kind);
  const [year, setYear] = useState(selected.year);
  const [spend, setSpend] = useState<{ byMonth: Map<string, number>; firstMonth: string | null } | null>(
    null
  );

  useEffect(() => {
    if (!visible) return;
    setMode(allowYear ? selected.kind : 'month');
    setYear(selected.year);
    let alive = true;
    getSpendByMonth(hideAmounts)
      .then((s) => alive && setSpend(s))
      .catch(() => alive && setSpend(null));
    return () => {
      alive = false;
    };
  }, [visible, selected.kind, selected.year, allowYear, hideAmounts]);

  const thisYear = today.getFullYear();
  const thisMonth = today.getMonth();
  const firstYear = spend?.firstMonth ? Number(spend.firstMonth.slice(0, 4)) : thisYear;
  const years: number[] = [];
  for (let y = Math.min(firstYear, selected.year, thisYear); y <= thisYear; y++) years.push(y);
  const todayIso = iso(thisYear, thisMonth, today.getDate());

  const yearTotal = (y: number) => {
    let t = 0;
    for (let m = 0; m < 12; m++) t += spend?.byMonth.get(monthKey(y, m)) ?? 0;
    return t;
  };
  const pick = (fn: () => void) => {
    haptics.tap();
    fn();
  };

  return (
    <ModalSheet
      visible={visible}
      onClose={onClose}
      title={allowYear ? 'Pick a period' : 'Jump to a month'}
      scrollable={false}
    >
      <View style={styles.body}>
        {allowYear && (
          <View style={styles.seg} accessibilityRole="radiogroup">
            {(['month', 'year'] as const).map((m) => (
              <Pressable
                key={m}
                onPress={() => setMode(m)}
                style={[styles.segBtn, mode === m && { backgroundColor: ink }]}
                accessibilityRole="radio"
                accessibilityState={{ selected: mode === m }}
              >
                <Text style={[styles.segText, mode === m && styles.onInk]}>
                  {m === 'month' ? 'Month' : 'Year'}
                </Text>
              </Pressable>
            ))}
          </View>
        )}

        {mode === 'month' ? (
          <>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.years}
            >
              {years.map((y) => {
                const on = y === year;
                return (
                  <Pressable
                    key={y}
                    onPress={() => setYear(y)}
                    style={withPressed([styles.yearChip, on && { backgroundColor: ink, borderColor: ink }])}
                    accessibilityRole="button"
                    accessibilityState={{ selected: on }}
                    accessibilityLabel={`${y}`}
                  >
                    <Text style={[styles.yearText, on && styles.onInk]}>{y}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
            <View style={styles.grid}>
              {Array.from({ length: 12 }, (_, m) => {
                const key = monthKey(year, m);
                const future = year > thisYear || (year === thisYear && m > thisMonth);
                const isSelected =
                  selected.kind === 'month' && selected.year === year && selected.month === m;
                const beforeFirst = !!spend?.firstMonth && key < spend.firstMonth && !isSelected;
                const off = future || beforeFirst;
                const now = year === thisYear && m === thisMonth;
                const total = spend?.byMonth.get(key);
                return (
                  <Pressable
                    key={m}
                    onPress={() => pick(() => onPickMonth(year, m))}
                    disabled={off}
                    style={withPressed([
                      styles.cell,
                      isSelected && { backgroundColor: ink, borderColor: ink },
                      off && styles.off,
                    ])}
                    accessibilityRole="button"
                    accessibilityLabel={`${longMonth(iso(year, m))} ${year}${now ? ', this month' : ''}`}
                    accessibilityState={{ selected: isSelected, disabled: off }}
                  >
                    <Text style={[styles.cellText, isSelected && styles.onInk]}>
                      {shortMonth(iso(year, m))}
                    </Text>
                    <Text style={[styles.cellSub, isSelected && styles.onInkSoft]} numberOfLines={1}>
                      {future ? ' ' : total ? compactMoney(total) : '—'}
                    </Text>
                    {now && <View style={[styles.nowDot, isSelected && styles.nowDotOn]} />}
                  </Pressable>
                );
              })}
            </View>

            {weeks && year === selected.year && (
              <View style={styles.weeks}>
                <Text style={styles.weeksLabel}>Weeks of {weeks.monthLabel}</Text>
                <View style={styles.weekRow}>
                  {weeks.ranges.map((r, i) => {
                    const on = weeks.index === i;
                    const future = r.start > todayIso;
                    const now = todayIso >= r.start && todayIso <= r.end;
                    const label = `${Number(r.start.slice(8))}–${Number(r.end.slice(8))}`;
                    return (
                      <Pressable
                        key={r.start}
                        onPress={() => pick(() => weeks.onPick(r.start))}
                        disabled={future}
                        style={withPressed([
                          styles.weekChip,
                          on && { backgroundColor: ink, borderColor: ink },
                          future && styles.off,
                        ])}
                        accessibilityRole="button"
                        accessibilityLabel={`Week ${i + 1} of ${weeks.ranges.length}, ${label}${now ? ', this week' : ''}`}
                        accessibilityState={{ selected: on, disabled: future }}
                      >
                        <Text style={[styles.weekText, on && styles.onInk]}>{label}</Text>
                        {now && <View style={[styles.nowDot, styles.weekDot, on && styles.nowDotOn]} />}
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            )}
          </>
        ) : (
          <View style={styles.grid}>
            {years.map((y) => {
              const on = selected.kind === 'year' && selected.year === y;
              const total = yearTotal(y);
              return (
                <Pressable
                  key={y}
                  onPress={() => pick(() => onPickYear?.(y))}
                  style={withPressed([styles.yearCell, on && { backgroundColor: ink, borderColor: ink }])}
                  accessibilityRole="button"
                  accessibilityLabel={`${y}${y === thisYear ? ', this year' : ''}`}
                  accessibilityState={{ selected: on }}
                >
                  <Text style={[styles.yearCellText, on && styles.onInk]}>{y}</Text>
                  <Text style={[styles.cellSub, on && styles.onInkSoft]} numberOfLines={1}>
                    {y === thisYear ? 'so far' : total ? `spent ${compactMoney(total)}` : '—'}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        )}

        <Pressable
          onPress={() => pick(() => onCurrent(mode))}
          style={withPressed(styles.current)}
          accessibilityRole="button"
        >
          <Text style={styles.currentText}>{mode === 'year' ? 'This year' : 'This month'}</Text>
        </Pressable>
      </View>
    </ModalSheet>
  );
}

const styles = StyleSheet.create({
  body: { gap: 14, paddingBottom: 4 },
  seg: {
    flexDirection: 'row',
    gap: 2,
    padding: 3,
    borderRadius: 18,
    backgroundColor: theme.colors.surfaceAlt,
  },
  segBtn: { flex: 1, height: 34, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  segText: { fontFamily: theme.font.bodyBold, fontSize: 13, color: theme.colors.textSecondary },
  onInk: { color: theme.colors.white },
  onInkSoft: { color: 'rgba(255,255,255,0.72)' },
  years: { gap: 6, paddingVertical: 1 },
  yearChip: {
    height: 34,
    paddingHorizontal: 16,
    borderRadius: 17,
    justifyContent: 'center',
    backgroundColor: theme.colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.borderSoft,
  },
  yearText: { fontFamily: theme.font.bodyBold, fontSize: 14, color: theme.colors.textSecondary },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  cell: {
    width: '23%',
    flexGrow: 1,
    minHeight: 50,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.borderSoft,
  },
  off: { opacity: 0.35 },
  cellText: { fontFamily: theme.font.bodyBold, fontSize: 14, color: theme.colors.textPrimary },
  cellSub: { fontFamily: theme.font.body, fontSize: 10.5, color: theme.colors.textMuted, marginTop: 1 },
  nowDot: {
    position: 'absolute',
    bottom: 5,
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: theme.colors.link,
  },
  nowDotOn: { backgroundColor: theme.colors.white },
  yearCell: {
    width: '31%',
    flexGrow: 1,
    minHeight: 58,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.borderSoft,
  },
  yearCellText: { fontFamily: theme.font.bodyBold, fontSize: 16, color: theme.colors.textPrimary },
  weeks: { gap: 8 },
  weeksLabel: { fontFamily: theme.font.bodyMedium, fontSize: 12.5, color: theme.colors.textSecondary },
  weekRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  weekChip: {
    minHeight: 34,
    paddingHorizontal: 12,
    borderRadius: 17,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.borderSoft,
  },
  weekText: { fontFamily: theme.font.bodyBold, fontSize: 13, color: theme.colors.textPrimary },
  weekDot: { bottom: 3 },
  current: {
    minHeight: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.borderSoft,
  },
  currentText: { fontFamily: theme.font.bodyBold, fontSize: 14, color: theme.colors.textPrimary },
});
