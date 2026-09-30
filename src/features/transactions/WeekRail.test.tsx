import { Text } from 'react-native';
import { create, act } from 'react-test-renderer';

import { WeekRail } from './WeekRail';
import { weekContaining } from './transactions.helpers';

const texts = (r: ReturnType<typeof create>) =>
  r.root.findAllByType(Text).map((t) => [t.props.children].flat(Infinity).join(''));

// The rail's tappable week segments, one per week (each is found once, by its label).
const segments = (r: ReturnType<typeof create>) =>
  r.root.findAll(
    (n) => typeof n.type === 'string' && /^Week \d of \d,/.test(n.props.accessibilityLabel ?? '')
  );

function rail(anchor: Date, todayIso: string, onPickWeek = jest.fn()) {
  let r!: ReturnType<typeof create>;
  act(() => {
    r = create(
      <WeekRail
        week={weekContaining(anchor)}
        monthLabel="Oct 2026"
        todayIso={todayIso}
        onPickWeek={onPickWeek}
      />
    );
  });
  return { r, onPickWeek };
}

describe('WeekRail', () => {
  it('names the month and the week, with its day count', () => {
    const { r } = rail(new Date(2026, 9, 1), '2026-10-01');
    expect(texts(r)).toEqual(['Oct 2026', 'Week 1 of 5 · 3 days']);
  });

  it('has one segment per week, and weeks that have not started cannot be picked', () => {
    const { r } = rail(new Date(2026, 9, 1), '2026-10-01');
    const segs = segments(r);
    expect(segs).toHaveLength(5);
    expect(segs.map((s) => s.props.accessibilityState.disabled)).toEqual([false, true, true, true, true]);
  });

  it('jumps to the tapped week', () => {
    const { r, onPickWeek } = rail(new Date(2026, 9, 15), '2026-10-20');
    const segs = segments(r);
    act(() => segs[0].props.onClick());
    expect(onPickWeek).toHaveBeenCalledWith('2026-10-01');
  });
});
