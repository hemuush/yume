import { buildTimeline } from './timelineLayout';

const TODAY = new Date(2026, 9, 2);

describe('buildTimeline', () => {
  it('returns null with no loans', () => {
    expect(buildTimeline([], TODAY)).toBeNull();
  });

  it('scales every bar to the latest end date and orders soonest first', () => {
    const t = buildTimeline(
      [
        { id: 'house', name: 'House', endDate: '2046-10-02' },
        { id: 'car', name: 'Car', endDate: '2036-10-02' },
      ],
      TODAY
    )!;
    expect(t.rows.map((r) => r.id)).toEqual(['car', 'house']);
    expect(t.rows[1].fraction).toBe(1);
    expect(t.rows[0].fraction).toBeCloseTo(0.5, 1);
    expect(t.endYear).toBe(2046);
    expect(t.midYear).toBe(2036);
  });

  it('keeps a loan that ends almost now visible', () => {
    const t = buildTimeline(
      [
        { id: 'a', name: 'A', endDate: '2026-11-02' },
        { id: 'b', name: 'B', endDate: '2046-10-02' },
      ],
      TODAY
    )!;
    expect(t.rows[0].fraction).toBeGreaterThanOrEqual(0.04);
  });

  it('drops the middle year when it would repeat the first or last', () => {
    const t = buildTimeline([{ id: 'a', name: 'A', endDate: '2027-04-02' }], TODAY)!;
    expect(t.midYear).toBeNull();
    expect(t.endYear).toBe(2027);
  });
});
