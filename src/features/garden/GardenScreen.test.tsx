import { create, act, ReactTestRenderer } from 'react-test-renderer';
import { Text } from 'react-native';

jest.setTimeout(30000);
jest.mock('react-native-reanimated', () => require('@/test-support/reanimatedMock').createReanimatedMock());
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 24, left: 0, right: 0 }),
}));
jest.mock('expo-router', () => ({
  router: { push: jest.fn() },
  useFocusEffect: (cb: () => void) => require('react').useEffect(cb, [cb]),
}));
jest.mock('@/components/AppHeader', () => ({ HeaderUserButton: () => null }));
jest.mock('@/components/AmountField', () => ({
  AmountField: () => null,
  AmountPadDock: ({ children }: { children: (props: unknown) => React.ReactNode }) =>
    children({ onScroll: jest.fn(), ref: { current: null } }),
}));
jest.mock('@/features/garden/GardenPlant', () => ({ GardenPlant: () => null }));
let mockHidden = false;
let mockGoal: number | null = 50000;
let mockSpent = 11500;
jest.mock('@/theme/PrivacyContext', () => ({ usePrivacy: () => ({ hideAmounts: mockHidden }) }));
jest.mock('@/db/settings', () => ({
  ...jest.requireActual('@/db/settings'),
  getDailySpendingGoal: async () => mockGoal,
}));
jest.mock('@/db/reports', () => ({
  getDailyGoalStreakSeries: async () => [
    { date: require('@/lib/date').toLocalIsoDate(new Date()), streakDays: 1, tracked: true },
  ],
  getTodaySpend: jest.fn(async () => mockSpent),
}));
import GardenScreen from '../../../app/garden';
import { getTodaySpend } from '@/db/reports';
const texts = (tree: ReactTestRenderer) =>
  tree.root.findAllByType(Text).map((n) => [n.props.children].flat(Infinity).join(''));
async function render() {
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = create(<GardenScreen />);
  });
  return tree;
}
beforeEach(() => {
  mockHidden = false;
  mockGoal = 50000;
  mockSpent = 11500;
  jest.clearAllMocks();
});
beforeAll(async () => {
  const tree = await render();
  act(() => tree.unmount());
}, 180000);
it.each([
  [11500, '₹385 left today'],
  [60000, "₹100 over today's goal"],
  [50000, '₹0 left today'],
])('shows remaining or exceeded allowance for %s', async (spent, label) => {
  mockSpent = spent as number;
  const tree = await render();
  expect(texts(tree)).toContain(label);
  expect(texts(tree)).toContain("Today's result can change until the day ends.");
  expect(
    tree.root.findAll((n) => n.props.accessibilityLabel === 'Change daily goal' && n.props.onPress).length
  ).toBeGreaterThan(0);
  act(() => tree.unmount());
});
it('omits the allowance while amounts are hidden', async () => {
  mockHidden = true;
  const tree = await render();
  expect(texts(tree).some((t) => t.includes('left today') || t.includes("over today's goal"))).toBe(false);
  act(() => tree.unmount());
});
it('keeps first-run setup and skips the allowance query without a daily goal', async () => {
  mockGoal = null;
  const tree = await render();
  expect(texts(tree)).toContain('Set a daily spending goal to start');
  expect(getTodaySpend).not.toHaveBeenCalled();
  act(() => tree.unmount());
});
