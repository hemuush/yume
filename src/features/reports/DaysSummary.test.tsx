import { create, act } from 'react-test-renderer';
import { Text } from 'react-native';
import { DaysSummary } from './DaysSummary';

jest.mock('react-native-reanimated', () => require('@/test-support/reanimatedMock').createReanimatedMock());
jest.mock('@/theme/PrivacyContext', () => ({ usePrivacy: () => ({ hideAmounts: false }) }));

type Props = React.ComponentProps<typeof DaysSummary>;
const shown = (over: Partial<Props> = {}) => {
  let tree!: ReturnType<typeof create>;
  act(() => {
    tree = create(
      <DaysSummary
        periodName="September 2026"
        inProgress={false}
        spentMinor={12430000}
        changeMinor={-820000}
        comparedTo="August"
        perDayMinor={414300}
        {...over}
      />
    );
  });
  return tree.root.findAllByType(Text).map((t) => [t.props.children].flat(Infinity).join(''));
};

describe('DaysSummary', () => {
  it('leads with the total, then how it compares and the daily average', () => {
    const t = shown();
    expect(t).toContain('Spent in September 2026');
    expect(t).toContain('₹8,200 less than August');
    expect(t.some((x) => x.includes('₹4,143 a day'))).toBe(true);
  });

  it('says "so far" for a period still running and shows no comparison', () => {
    const t = shown({ inProgress: true, changeMinor: null });
    expect(t).toContain('Spent in September 2026 so far');
    expect(t.some((x) => /more than|less than/.test(x))).toBe(false);
    expect(t.some((x) => x.includes('a day'))).toBe(true);
  });

  it('says more when spending went up, and nothing when it is unchanged', () => {
    expect(shown({ changeMinor: 50000 })).toContain('₹500 more than August');
    expect(shown({ changeMinor: 0 }).some((x) => /more than|less than/.test(x))).toBe(false);
  });
});
