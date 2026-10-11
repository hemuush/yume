/**
 * Every beat kind renders, moving and still (reduce motion), including unusual months: more out than in, a
 * steady week, an empty week, a sensitive category with savings amounts hidden. Made-up figures.
 */
import { create, act, ReactTestRenderer } from 'react-test-renderer';
import { Text } from 'react-native';

jest.mock('react-native-reanimated', () => require('@/test-support/reanimatedMock').createReanimatedMock());
jest.mock('expo-sharing', () => ({ shareAsync: jest.fn(async () => {}) }));
const mockDeleted: string[] = [];
jest.mock('expo-file-system', () => ({
  File: class {
    uri: string;
    constructor(uri: string) {
      this.uri = uri;
    }
    delete() {
      mockDeleted.push(this.uri);
    }
  },
}));
jest.mock('@/theme/PrivacyContext', () => ({
  usePrivacy: () => ({ hideAmounts: true, toggleHideAmounts: jest.fn() }),
}));

import { Beat } from './WrapBeats';
import { Wrap, WrapBeat, fillDays } from './wrapData';

jest.useFakeTimers();

const food = {
  categoryId: 'food',
  name: 'Food & Dining',
  color: '#FFC9B3',
  totalMinor: 980_000,
  isSensitive: false,
};
const invest = {
  categoryId: 'inv',
  name: 'Investments',
  color: '#8FE8C8',
  totalMinor: 500_000,
  isSensitive: true,
};
const monthDays = fillDays('2026-09-01', '2026-09-30', [
  { date: '2026-09-01', totalMinor: 1_560_000 },
  { date: '2026-09-12', totalMinor: 290_000 },
]);
const weekDays = fillDays('2026-09-20', '2026-09-26', [{ date: '2026-09-23', totalMinor: 190_000 }]);

const BEATS: [string, WrapBeat][] = [
  ['hook', { kind: 'hook', kicker: 'Your month, wrapped', title: 'September', spentMinor: 3_840_000 }],
  ['kept', { kind: 'kept', incomeMinor: 4_920_000, keptMinor: 1_080_000, keptPct: 21.95 }],
  ['kept, overspent', { kind: 'kept', incomeMinor: 500_000, keptMinor: -100_000, keptPct: -20 }],
  ['bars', { kind: 'bars', items: [food, invest] }],
  ['bars, one category', { kind: 'bars', items: [food] }],
  [
    'days',
    {
      kind: 'days',
      days: monthDays,
      firstWeekday: 2,
      heaviest: monthDays[0],
      quietDays: 28,
    },
  ],
  ['mover', { kind: 'mover', category: invest, pctChange: 32, comparedTo: 'August' }],
  ['weekDays', { kind: 'weekDays', days: weekDays, heaviest: weekDays[3], quietDays: 6 }],
  ['usual, lighter', { kind: 'usual', changePct: -12, top: food }],
  ['usual, steady', { kind: 'usual', changePct: 2, top: null }],
  ['final', { kind: 'final', title: 'A quiet week. Nothing went out.' }],
];

const WRAP: Wrap = { period: 'month', label: 'September', key: '2026-09', beats: BEATS.map(([, b]) => b) };

function texts(r: ReactTestRenderer): string {
  return r.root
    .findAllByType(Text)
    .map((t) => [t.props.children].flat(Infinity).join(''))
    .join(' | ');
}

describe.each([false, true])('beats (still: %s)', (still) => {
  it.each(BEATS)('%s renders', (_name, beat) => {
    let r!: ReactTestRenderer;
    act(() => {
      r = create(<Beat wrap={WRAP} beat={beat} still={still} onOpenReport={jest.fn()} />);
    });
    act(() => jest.advanceTimersByTime(3000));
    expect(texts(r).length).toBeGreaterThan(0);
    act(() => r.unmount());
  });
});

describe('beat wording', () => {
  function render(beat: WrapBeat) {
    let r!: ReactTestRenderer;
    act(() => {
      r = create(<Beat wrap={WRAP} beat={beat} still onOpenReport={jest.fn()} />);
    });
    return r;
  }

  it('says so when more went out than came in', () => {
    const r = render({ kind: 'kept', incomeMinor: 500_000, keptMinor: -100_000, keptPct: -20 });
    expect(texts(r)).toContain('More went out than came in.');
    expect(texts(r)).toContain('₹1,000');
  });

  it('says so when exactly what came in went out, never "₹0 more"', () => {
    const r = render({ kind: 'kept', incomeMinor: 500_000, keptMinor: 0, keptPct: 0 });
    expect(texts(r)).toContain('Everything that came in went out.');
    expect(texts(r)).not.toContain('More went out');
  });

  it('masks a sensitive category when hidden amounts are on', () => {
    const r = render({ kind: 'mover', category: invest, pctChange: 32, comparedTo: 'August' });
    expect(texts(r)).toContain('₹••••');
    expect(texts(r)).not.toContain('₹5,000');
  });

  it('names the heaviest day and counts the quiet ones', () => {
    const r = render({
      kind: 'days',
      days: monthDays,
      firstWeekday: 2,
      heaviest: monthDays[0],
      quietDays: 28,
    });
    expect(texts(r)).toMatch(/1 Sept? was the heaviest day\./);
    expect(texts(r)).toContain('28 days with no recorded spending.');
  });

  it('calls a week within 5% of usual the same as usual', () => {
    expect(texts(render({ kind: 'usual', changePct: 2, top: null }))).toContain(
      'About the same as a usual week.'
    );
  });

  it('shows a lighter week in the income colour, a heavier one in the expense colour', () => {
    expect(texts(render({ kind: 'usual', changePct: -12, top: food }))).toContain('less than a usual week.');
    expect(texts(render({ kind: 'usual', changePct: 30, top: food }))).toContain('more than a usual week.');
  });

  it('closes on a card with the total and the top categories, which Share sends as a picture', async () => {
    const r = render({ kind: 'final', title: 'That was September.' });
    expect(texts(r)).toContain('September');
    expect(texts(r)).toContain('₹38,400');
    expect(texts(r)).toContain('Food & Dining');
    const share = r.root.find((n) => n.props.title === 'Share' && n.props.onPress);
    await act(async () => {
      await share.props.onPress();
    });
    expect(require('react-native-view-shot').captureRef).toHaveBeenCalled();
    expect(require('expo-sharing').shareAsync).toHaveBeenCalledWith(
      'file:///wrap.png',
      expect.objectContaining({ mimeType: 'image/png' })
    );
  });

  it('removes the temp picture once it has been shared', async () => {
    mockDeleted.length = 0;
    const r = render({ kind: 'final', title: 'That was September.' });
    const share = r.root.find((n) => n.props.title === 'Share' && n.props.onPress);
    await act(async () => {
      await share.props.onPress();
    });
    expect(mockDeleted).toEqual(['file:///wrap.png']);
  });

  it('keeps Share off until the card has faded in, so it never sends a half-transparent picture', async () => {
    const captureRef = require('react-native-view-shot').captureRef as jest.Mock;
    captureRef.mockClear();
    let r!: ReactTestRenderer;
    act(() => {
      r = create(
        <Beat
          wrap={WRAP}
          beat={{ kind: 'final', title: 'That was September.' }}
          still={false}
          onOpenReport={jest.fn()}
        />
      );
    });
    const share = () => r.root.find((n) => n.props.title === 'Share' && n.props.onPress);
    expect(share().props.disabled).toBe(true);
    await act(async () => {
      await share().props.onPress();
    });
    expect(captureRef).not.toHaveBeenCalled();
    act(() => jest.advanceTimersByTime(3000));
    expect(share().props.disabled).toBe(false);
  });
});

function interactiveButton(r: ReactTestRenderer, label: string) {
  return r.root.findAll(
    (node) => node.props.accessibilityLabel === label && typeof node.props.onPress === 'function'
  )[0];
}

it('selects a calendar day, pauses exploration and opens that exact day', () => {
  const onInteract = jest.fn();
  const onOpenDay = jest.fn();
  let r!: ReactTestRenderer;
  act(() => {
    r = create(
      <Beat
        wrap={WRAP}
        beat={BEATS.find(([name]) => name === 'days')![1]}
        still
        onOpenReport={jest.fn()}
        onInteract={onInteract}
        onOpenDay={onOpenDay}
      />
    );
  });
  act(() =>
    interactiveButton(r, `Select ${require('@/lib/dateLabels').dayMonth('2026-09-12')}`).props.onPress()
  );
  expect(onInteract).toHaveBeenCalledTimes(1);
  expect(texts(r)).toContain('₹2,900');
  act(() =>
    interactiveButton(
      r,
      `Open report for ${require('@/lib/dateLabels').dayMonth('2026-09-12')}`
    ).props.onPress()
  );
  expect(onOpenDay).toHaveBeenCalledWith('2026-09-12');
  act(() =>
    interactiveButton(r, `Select ${require('@/lib/dateLabels').dayMonth('2026-09-13')}`).props.onPress()
  );
  expect(texts(r)).toContain('No spending recorded');
  act(() => r.unmount());
});

it('lets a category reveal its share of the full period while preserving sensitive amount masking', () => {
  const onInteract = jest.fn();
  let r!: ReactTestRenderer;
  act(() => {
    r = create(
      <Beat
        wrap={WRAP}
        beat={{ kind: 'bars', items: [food, invest] }}
        still
        onOpenReport={jest.fn()}
        onInteract={onInteract}
      />
    );
  });
  act(() => interactiveButton(r, 'Explore Investments').props.onPress());
  expect(onInteract).toHaveBeenCalledTimes(1);
  expect(texts(r)).toContain('13% of recorded spending');
  expect(texts(r)).not.toContain('₹5,000');
  act(() => r.unmount());
});

it('does not start two picture captures when Share is tapped repeatedly', async () => {
  const capture = require('react-native-view-shot').captureRef as jest.Mock;
  capture.mockClear();
  let r!: ReactTestRenderer;
  act(() => {
    r = create(<Beat wrap={WRAP} beat={{ kind: 'final', title: 'Done' }} still onOpenReport={jest.fn()} />);
  });
  const share = r.root.find((node) => node.props.title === 'Share' && node.props.onPress);
  await act(async () => {
    await Promise.all([share.props.onPress(), share.props.onPress()]);
  });
  expect(capture).toHaveBeenCalledTimes(1);
  act(() => r.unmount());
});

it('the closing card does not describe overspending as exactly breaking even', () => {
  const final = { kind: 'final' as const, title: 'Done' };
  const wrap: Wrap = {
    ...WRAP,
    beats: [WRAP.beats[0], { kind: 'kept', incomeMinor: 100000, keptMinor: -20000, keptPct: -20 }, final],
  };
  let r!: ReactTestRenderer;
  act(() => {
    r = create(<Beat wrap={wrap} beat={final} still onOpenReport={jest.fn()} />);
  });
  expect(texts(r)).toContain('More went out than came in');
  expect(texts(r)).not.toContain('Everything that came in went out');
  act(() => r.unmount());
});

it('an empty week still has a useful share card with a zero total', () => {
  const final = { kind: 'final' as const, title: 'A quiet week. Nothing went out.' };
  const wrap: Wrap = { period: 'week', key: '2026-09-20', label: '20–26 Sept', beats: [final] };
  let r!: ReactTestRenderer;
  act(() => {
    r = create(<Beat wrap={wrap} beat={final} still onOpenReport={jest.fn()} />);
  });
  expect(texts(r)).toContain('₹0');
  expect(texts(r)).toContain('No spending recorded');
  act(() => r.unmount());
});
