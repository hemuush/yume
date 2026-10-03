/**
 * The two times of day Yume notifies at. Their ranges never overlap, so a
 * Morning and an Evening notification can never arrive together.
 */
export const TIME_STEP_MINUTES = 30;

export const MORNING_RANGE = { min: 5 * 60, max: 11 * 60 + 30 } as const;
export const EVENING_RANGE = { min: 16 * 60, max: 23 * 60 + 30 } as const;

export type TimeSlotKind = 'morning' | 'evening';

export const TIME_RANGES: Record<TimeSlotKind, { min: number; max: number }> = {
  morning: MORNING_RANGE,
  evening: EVENING_RANGE,
};

/** Keeps a time of day (minutes after midnight) inside its slot's range, on the 30-minute grid. */
export function clampSlotMinutes(kind: TimeSlotKind, minutes: number): number {
  const { min, max } = TIME_RANGES[kind];
  const snapped = Math.round(minutes / TIME_STEP_MINUTES) * TIME_STEP_MINUTES;
  return Math.min(max, Math.max(min, snapped));
}

/** "9:00 AM". */
export function formatSlotTime(minutes: number): string {
  const hour = Math.floor(minutes / 60);
  const minute = minutes % 60;
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${h12}:${minute.toString().padStart(2, '0')} ${hour < 12 ? 'AM' : 'PM'}`;
}

/** "Between 5:00 and 11:30 AM" — the range a slot's time can be set within. */
export function slotRangeLabel(kind: TimeSlotKind): string {
  const { min, max } = TIME_RANGES[kind];
  const from = formatSlotTime(min);
  const to = formatSlotTime(max);
  const [fromClock, fromSuffix] = from.split(' ');
  const [, toSuffix] = to.split(' ');
  return fromSuffix === toSuffix ? `Between ${fromClock} and ${to}` : `Between ${from} and ${to}`;
}
