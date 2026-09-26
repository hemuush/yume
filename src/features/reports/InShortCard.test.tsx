/**
 * Reports' "In short" card and Home's month-in-review card: each renders
 * what it's given, says "too early" instead of guessing, and routes taps to
 * the right place (✕ hides without also opening the report).
 */
import { create, act, ReactTestRenderer } from 'react-test-renderer';
import { Text } from 'react-native';

// First render loads React Native's components; on a cold parallel run
// that can outlast Jest's 5s default (see the warm-up below too).
jest.setTimeout(30000);

jest.mock('react-native-reanimated', () => require('@/test-support/reanimatedMock').createReanimatedMock());

import { InShortCard } from './InShortCard';
import { MonthInReviewCard } from '@/features/home/MonthInReviewCard';
import type { InShortLine } from './reportsInsights';
import type { MonthReview } from '@/features/home/monthReview';

const lines: InShortLine[] = [
  {
    key: 'mover',
    icon: 'trending-up',
    bold: 'Food',
    text: ' is up 32% vs the month before',
    target: 'categories',
  },
  {
    key: 'read-0',
    icon: 'calendar',
    text: 'Weekends run 64% above your weekday average.',
    target: 'overview',
  },
];
const review: MonthReview = {
  monthKey: '2026-09',
  monthLabel: 'September',
  spentMinor: 3842000,
  keptLabel: '22%',
  topCategoryName: 'Food',
  line: 'Food was up 32% on August.',
};

async function render(el: React.ReactElement) {
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = create(el);
  });
  return tree;
}
const texts = (tree: ReactTestRenderer) =>
  tree.root.findAllByType(Text).map((t) => [].concat(t.props.children).join(''));
const byLabel = (tree: ReactTestRenderer, label: string) =>
  tree.root.find((n) => n.props.accessibilityLabel === label && n.props.onPress);

// Loads React Native's lazily-required components once, with a generous budget.
beforeAll(async () => {
  await render(<InShortCard lines={lines} tooEarly={false} onJump={() => {}} />);
  await render(<MonthInReviewCard review={review} onOpen={() => {}} onDismiss={() => {}} />);
}, 180000);

describe('InShortCard', () => {
  it('lists each line and jumps to its section when tapped', async () => {
    const onJump = jest.fn();
    const tree = await render(<InShortCard lines={lines} tooEarly={false} onJump={onJump} />);
    expect(texts(tree)).toContain('In short');
    // Each row reads as one sentence (the bold category name and the rest together).
    const rowLabels = tree.root
      .findAll(
        (n) =>
          n.props.accessibilityRole === 'button' &&
          typeof n.props.accessibilityLabel === 'string' &&
          n.props.onPress
      )
      .map((n) => n.props.accessibilityLabel);
    expect([...new Set(rowLabels)]).toEqual([
      'Food is up 32% vs the month before',
      'Weekends run 64% above your weekday average.',
    ]);
    act(() => byLabel(tree, 'Food is up 32% vs the month before').props.onPress());
    act(() => byLabel(tree, 'Weekends run 64% above your weekday average.').props.onPress());
    expect(onJump.mock.calls).toEqual([['categories'], ['overview']]);
  });

  it('says it is too early instead of guessing', async () => {
    const tree = await render(<InShortCard lines={[]} tooEarly onJump={() => {}} />);
    expect(texts(tree)).toContain('Too early to tell. Check back after a few more days.');
  });

  it('renders nothing when there is nothing to say', async () => {
    const tree = await render(<InShortCard lines={[]} tooEarly={false} onJump={() => {}} />);
    expect(tree.toJSON()).toBeNull();
  });
});

describe('MonthInReviewCard', () => {
  it('shows the month, its figures and its line', async () => {
    const tree = await render(<MonthInReviewCard review={review} onOpen={() => {}} onDismiss={() => {}} />);
    const shown = texts(tree);
    expect(shown).toEqual(
      expect.arrayContaining(['September in review', '22%', 'Food', 'Food was up 32% on August.'])
    );
    expect(shown.some((t) => t.startsWith('See September'))).toBe(true);
  });

  it('opens the report from the card, and ✕ only hides it', async () => {
    const onOpen = jest.fn();
    const onDismiss = jest.fn();
    const tree = await render(<MonthInReviewCard review={review} onOpen={onOpen} onDismiss={onDismiss} />);
    act(() => byLabel(tree, 'Hide until next month').props.onPress());
    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(onOpen).not.toHaveBeenCalled();
    const card = tree.root.find(
      (n) =>
        typeof n.props.accessibilityLabel === 'string' &&
        n.props.accessibilityLabel.startsWith('September in review') &&
        n.props.onPress
    );
    act(() => card.props.onPress());
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it('shows a dash for kept when the month had no income', async () => {
    const tree = await render(
      <MonthInReviewCard review={{ ...review, keptLabel: null }} onOpen={() => {}} onDismiss={() => {}} />
    );
    expect(texts(tree)).toContain('—');
  });
});
