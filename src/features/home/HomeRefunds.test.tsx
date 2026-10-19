import { act, create, ReactTestRenderer } from 'react-test-renderer';
import { Text } from 'react-native';
import type { ExpectedRefund } from '@/db/refundTracking';
let mockHide = false;
jest.mock('@/theme/PrivacyContext', () => ({ usePrivacy: () => ({ hideAmounts: mockHide }) }));
jest.mock('@expo/vector-icons/Feather', () => () => null);
jest.mock('@expo/vector-icons/MaterialCommunityIcons', () => () => null);
jest.mock('react-native-reanimated', () => require('@/test-support/reanimatedMock').createReanimatedMock());
jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
jest.mock('./HomeSwipeCard', () => ({
  HomeSwipeCard: (props: object) =>
    require('react').createElement(require('react-native').View, { ...props, testID: 'glance-pages' }),
}));
import { HomeRefunds } from './HomeRefunds';
import { HomeGlance } from './HomeGlance';
const refund = (id: string, dueDate: string | null = null): ExpectedRefund => ({
  id,
  transactionId: `tx-${id}`,
  label: `Purchase ${id}`,
  expectedMinor: 10000,
  receivedMinor: 2000,
  remainingMinor: 8000,
  dueDate,
  closed: false,
  currency: 'INR',
  receipts: [],
});
let roots: ReactTestRenderer[] = [];
function render(node: React.ReactElement) {
  let tree!: ReactTestRenderer;
  act(() => {
    tree = create(node);
  });
  roots.push(tree);
  return tree;
}
const texts = (tree: ReactTestRenderer) =>
  tree.root
    .findAllByType(Text)
    .map((t) => [t.props.children].flat(Infinity).join(''))
    .join(' ');
const press = (tree: ReactTestRenderer, prefix: string) =>
  act(() =>
    tree.root
      .findAll(
        (n) =>
          typeof n.props.accessibilityLabel === 'string' &&
          n.props.accessibilityLabel.startsWith(prefix) &&
          n.props.onPress
      )[0]
      .props.onPress()
  );
afterEach(() => {
  act(() => roots.forEach((r) => r.unmount()));
  roots = [];
  mockHide = false;
});
it('shows the remaining amount and opens the original purchase', () => {
  const open = jest.fn();
  const tree = render(<HomeRefunds refunds={[refund('a')]} failed={false} onOpen={open} />);
  expect(texts(tree)).toContain('₹80');
  expect(texts(tree)).toContain('not included in your balance');
  expect(texts(tree)).toContain('No expected date');
  press(tree, 'Purchase a,');
  expect(open).toHaveBeenCalledWith('tx-a');
});
it('sorts overdue and dated expectations before undated purchases', () => {
  const tree = render(
    <HomeRefunds
      refunds={[refund('none'), refund('later', '2099-01-01'), refund('late', '2020-01-01')]}
      failed={false}
      onOpen={jest.fn()}
    />
  );
  const labels = tree.root
    .findAll(
      (n) =>
        n.props.accessibilityRole === 'button' &&
        n.props.onPress &&
        n.props.accessibilityLabel?.startsWith('Purchase')
    )
    .map((n) => n.props.accessibilityLabel);
  expect(labels[0]).toContain('Purchase late');
  expect(labels[0]).toContain('Overdue');
  expect(labels[2]).toContain('Purchase none');
});
it('masks sensitive amounts in visible and spoken text while retaining other refunds', () => {
  mockHide = true;
  const tree = render(
    <HomeRefunds
      refunds={[{ ...refund('private'), isSensitive: true, remainingMinor: 1234500 }, refund('public')]}
      failed={false}
      onOpen={jest.fn()}
    />
  );
  expect(texts(tree)).not.toContain('12,345');
  expect(texts(tree)).toContain('₹80');
  expect(tree.root.findAll((n) => n.props.accessibilityLabel?.includes('12,345'))).toHaveLength(0);
});
it('expands all purchases and reports query failure with retry', () => {
  const retry = jest.fn();
  const tree = render(
    <HomeRefunds refunds={['a', 'b', 'c', 'd'].map((id) => refund(id))} failed={false} onOpen={jest.fn()} />
  );
  expect(texts(tree)).not.toContain('Purchase d');
  const button = tree.root.findAll((n) => n.props.title === 'View all 4 refunds' && n.props.onPress)[0];
  act(() => button.props.onPress());
  expect(texts(tree)).toContain('Purchase d');
  act(() => tree.update(<HomeRefunds refunds={[]} failed onRetry={retry} />));
  act(() =>
    tree.root.findAll((n) => n.props.title === 'Retry refunds' && n.props.onPress)[0].props.onPress()
  );
  expect(retry).toHaveBeenCalledTimes(1);
});
it('shows compact refunds below Coming up only for pending data or a failed read', () => {
  const props = {
    upcoming: { items: [], next: null },
    rowEntering: () => undefined,
    onSeeMoreUpcoming: jest.fn(),
  };
  const tree = render(<HomeGlance {...props} refunds={[refund('a')]} />);
  expect(texts(tree)).toContain('₹80 refund pending');
  expect(tree.root.findAll((n) => n.props.accessibilityRole === 'tab')).toHaveLength(0);
  act(() => tree.update(<HomeGlance {...props} refunds={[]} />));
  expect(texts(tree)).not.toContain('refund pending');
  act(() => tree.update(<HomeGlance {...props} refunds={[]} refundError />));
  expect(texts(tree)).toContain('Couldn’t load refunds');
});

it('previews two payments without tabs and keeps the full schedule reachable', () => {
  const { router } = require('expo-router');
  const item = (key: string) => ({
    key,
    icon: 'file-text' as const,
    iconBg: '#fff',
    title: key,
    subtitle: 'Due today',
    amountMinor: 10000,
    sign: '-' as const,
    sortDate: '2026-10-19',
    route: '/recurring' as const,
    urgent: true,
    payable: false,
    pinned: true,
  });
  const all = jest.fn();
  const tree = render(
    <HomeGlance
      upcoming={{ items: [item('First'), item('Second'), item('Third')], next: null }}
      rowEntering={() => undefined}
      onSeeMoreUpcoming={all}
    />
  );
  expect(texts(tree)).toContain('First');
  expect(texts(tree)).toContain('Second');
  expect(texts(tree)).not.toContain('Third');
  const { UpcomingRow } = require('./UpcomingRow');
  act(() => tree.root.findAllByType(UpcomingRow)[0].props.onPress());
  expect(router.push).toHaveBeenCalledWith('/recurring');
  press(tree, 'View plan — Next up');
  expect(all).toHaveBeenCalledTimes(1);
});
