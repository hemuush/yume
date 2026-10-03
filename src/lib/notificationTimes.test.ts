import {
  EVENING_RANGE,
  MORNING_RANGE,
  clampSlotMinutes,
  formatSlotTime,
  slotRangeLabel,
} from './notificationTimes';

describe('notificationTimes', () => {
  it('keeps the two slots from ever overlapping', () => {
    expect(MORNING_RANGE.max).toBeLessThan(EVENING_RANGE.min);
  });

  it('pulls a time into its slot and onto the 30-minute grid', () => {
    expect(clampSlotMinutes('morning', 3 * 60)).toBe(MORNING_RANGE.min);
    expect(clampSlotMinutes('morning', 14 * 60)).toBe(MORNING_RANGE.max);
    expect(clampSlotMinutes('evening', 8 * 60)).toBe(EVENING_RANGE.min);
    expect(clampSlotMinutes('evening', 23 * 60 + 59)).toBe(EVENING_RANGE.max);
    expect(clampSlotMinutes('morning', 9 * 60 + 14)).toBe(9 * 60);
    expect(clampSlotMinutes('morning', 9 * 60 + 16)).toBe(9 * 60 + 30);
  });

  it('writes a time of day as a 12-hour clock', () => {
    expect(formatSlotTime(9 * 60)).toBe('9:00 AM');
    expect(formatSlotTime(0)).toBe('12:00 AM');
    expect(formatSlotTime(12 * 60 + 30)).toBe('12:30 PM');
    expect(formatSlotTime(20 * 60 + 30)).toBe('8:30 PM');
  });

  it('says the range each slot can be set within', () => {
    expect(slotRangeLabel('morning')).toBe('Between 5:00 and 11:30 AM');
    expect(slotRangeLabel('evening')).toBe('Between 4:00 and 11:30 PM');
  });
});
