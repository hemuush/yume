import { act, create, ReactTestRenderer } from 'react-test-renderer';
import { Text } from 'react-native';
jest.mock('react-native-reanimated', () => require('@/test-support/reanimatedMock').createReanimatedMock());
jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
const mockHidden = { value: false };
jest.mock('@/theme/PrivacyContext', () => ({ usePrivacy: () => ({ hideAmounts: mockHidden.value }) }));
jest.mock('@/db/spendingExplanation', () => ({
  getSpendingExplanation: jest.fn(async () => ({
    deltaMinor: 10000,
    frequencyMinor: 5000,
    sizeMinor: 6000,
    refundsMinor: -1000,
    newCategory: false,
    currentAverage: 15000,
    previousAverage: 10000,
    current: { count: 2 },
    previous: { count: 1 },
    ranges: {
      current: { start: '2026-10-01', end: '2026-10-12' },
      previous: { start: '2026-09-01', end: '2026-09-12' },
      days: 12,
    },
    largest: [{ id: 'entry', date: '2026-10-10', amount_minor: 15000, note: 'Dinner' }],
  })),
}));
import { SpendingExplanation } from './SpendingExplanation';
import { getSpendingExplanation } from '@/db/spendingExplanation';
import { router } from 'expo-router';
const current = { start: '2026-10-01', end: '2026-10-31' },
  previous = { start: '2026-09-01', end: '2026-09-30' };
const words = (t: ReactTestRenderer) =>
  t.root
    .findAllByType(Text)
    .map((n) => [n.props.children].flat().join(''))
    .join(' ');
beforeEach(() => {
  mockHidden.value = false;
  jest.clearAllMocks();
});
it('does not invent a three-row explanation when both periods have no activity', async () => {
  const baseline = await getSpendingExplanation('food', current, previous, false);
  jest.mocked(getSpendingExplanation).mockResolvedValueOnce({
    ...baseline,
    deltaMinor: 0,
    frequencyMinor: 0,
    sizeMinor: 0,
    refundsMinor: 0,
    current: { count: 0, grossMinor: 0, refundMinor: 0 },
    previous: { count: 0, grossMinor: 0, refundMinor: 0 },
    largest: [],
  });
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = create(<SpendingExplanation categoryId="food" current={current} previous={previous} />);
  });
  expect(words(tree)).toContain('No spending to compare');
  expect(words(tree)).not.toContain('Purchase frequency');
  expect(words(tree)).not.toContain('Refund changes');
  await act(async () => tree.unmount());
});
it('shows matching dates, explains the three effects and opens a contributing entry', async () => {
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = create(<SpendingExplanation categoryId="food" current={current} previous={previous} />);
  });
  expect(getSpendingExplanation).toHaveBeenCalledWith('food', current, previous, false);
  await act(async () =>
    tree.root
      .find(
        (n) => n.props.accessibilityLabel === 'Comparison details' && typeof n.props.onPress === 'function'
      )
      .props.onPress()
  );
  expect(words(tree)).toContain('12 days in each');
  expect(words(tree)).toContain('Purchase frequency');
  expect(words(tree)).toContain('₹50');
  expect(words(tree)).toContain('-₹10');
  expect(words(tree)).not.toContain('Dinner');
  await act(async () =>
    tree.root
      .find(
        (n) =>
          n.props.accessibilityLabel === 'Largest contributing entries' &&
          typeof n.props.onPress === 'function'
      )
      .props.onPress()
  );
  await act(async () =>
    tree.root
      .find(
        (n) => typeof n.props.onPress === 'function' && String(n.props.accessibilityLabel).includes('Dinner')
      )
      .props.onPress()
  );
  expect(router.push).toHaveBeenCalledWith('/transactions?entry=entry');
  await act(async () => tree.unmount());
});
it('excludes sensitive query data but keeps everyday explanations readable', async () => {
  mockHidden.value = true;
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = create(<SpendingExplanation categoryId="food" current={current} previous={previous} />);
  });
  expect(getSpendingExplanation).toHaveBeenCalledWith('food', current, previous, true);
  expect(words(tree)).toContain('₹100');
  expect(words(tree)).not.toContain('••••');
  await act(async () => tree.unmount());
});

it('does not reuse unfiltered figures while a privacy-scoped reload is pending', async () => {
  mockHidden.value = false;
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = create(<SpendingExplanation categoryId="food" current={current} previous={previous} />);
  });
  expect(words(tree)).toContain('₹100');
  jest.mocked(getSpendingExplanation).mockImplementationOnce(() => new Promise(() => {}));
  mockHidden.value = true;
  await act(async () => {
    tree.update(<SpendingExplanation categoryId="food" current={current} previous={previous} />);
  });
  expect(words(tree)).not.toContain('₹100');
  await act(async () => tree.unmount());
});
