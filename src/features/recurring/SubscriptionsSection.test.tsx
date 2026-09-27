/**
 * The top of Recurring: the monthly and yearly cost of running expense
 * rules, and "Not set up yet" rows that open a filled-in rule or hide for
 * good. Nothing shows when there's neither.
 */
import { create, act, ReactTestRenderer } from 'react-test-renderer';
import { Text } from 'react-native';

jest.mock('react-native-reanimated', () => require('@/test-support/reanimatedMock').createReanimatedMock());

import { SubscriptionsSection } from './SubscriptionsSection';
import { SubscriptionSuggestion } from '@/db/subscriptions';

const streamA: SubscriptionSuggestion = {
  key: 'sub-a',
  categoryId: 'a',
  categoryName: 'Stream A',
  icon: 'tag',
  color: '#C9B8FF',
  accountId: 'bank',
  amountMinor: 199900,
  date: '2026-09-09',
  note: '',
  source: 'subscriptions',
};
const wifi: SubscriptionSuggestion = {
  ...streamA,
  key: 'sub-w',
  categoryName: 'Wifi',
  source: 'pattern',
  months: 3,
};

const texts = (tree: ReactTestRenderer) =>
  tree.root.findAllByType(Text).map((t) => [t.props.children].flat().join(''));
const byLabel = (tree: ReactTestRenderer, label: string) =>
  tree.root.find((n) => n.props.accessibilityLabel === label && typeof n.props.onPress === 'function');

async function render(props: Partial<React.ComponentProps<typeof SubscriptionsSection>> = {}) {
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = create(
      <SubscriptionsSection
        totals={{ monthlyMinor: 29900, yearlyMinor: 358800, count: 1 }}
        suggestions={[streamA, wifi]}
        onMakeRecurring={jest.fn()}
        onHide={jest.fn()}
        hasRunning
        {...props}
      />
    );
  });
  return tree;
}

describe('SubscriptionsSection', () => {
  it('shows the month, the year and how many are running', async () => {
    const shown = texts(await render());
    expect(shown).toEqual(expect.arrayContaining(['SUBSCRIPTIONS & BILLS', '₹3,588 a year · 1 running']));
    expect(shown.some((t) => t.startsWith('₹299'))).toBe(true);
  });

  it('describes each suggestion by where it came from', async () => {
    const shown = texts(await render());
    expect(shown.some((t) => t.startsWith('₹1,999 on 9'))).toBe(true);
    expect(shown).toContain('₹1,999 each month · 3 months in a row');
  });

  it('makes one recurring or hides it', async () => {
    const onMakeRecurring = jest.fn();
    const onHide = jest.fn();
    const tree = await render({ onMakeRecurring, onHide });
    act(() => byLabel(tree, 'Make Stream A recurring').props.onPress());
    expect(onMakeRecurring).toHaveBeenCalledWith(streamA);
    act(() => byLabel(tree, 'Hide Wifi').props.onPress());
    expect(onHide).toHaveBeenCalledWith(wifi);
  });

  it('shows nothing with no rules and no suggestions', async () => {
    const tree = await render({ totals: { monthlyMinor: 0, yearlyMinor: 0, count: 0 }, suggestions: [] });
    expect(tree.toJSON()).toBeNull();
  });

  it('only heads the rule list RUNNING when a rule is running', async () => {
    expect(texts(await render())).toContain('RUNNING');
    expect(texts(await render({ hasRunning: false }))).not.toContain('RUNNING');
  });
});
