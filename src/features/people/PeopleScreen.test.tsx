/**
 * The Friends & Family screen on its own route: each person shows who owes
 * whom, and with no one added it invites the first person.
 */
import { create, act, ReactTestRenderer } from 'react-test-renderer';
import { Text } from 'react-native';

jest.setTimeout(30000);

jest.mock('react-native-reanimated', () => require('@/test-support/reanimatedMock').createReanimatedMock());
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('@/components/AppHeader', () => ({ AppHeader: () => null }));
jest.mock('expo-router', () => ({
  router: { push: jest.fn() },
  useFocusEffect: (cb: () => void) => require('react').useEffect(cb, [cb]),
}));
const mockPeople = {
  current: [] as { id: string; name: string; balanceMinor: number; lastActivityDate: null }[],
};
jest.mock('@/db/people', () => ({ listPeople: async () => mockPeople.current }));
// The totals' count-up animation would keep ticking past the test's end.
jest.mock('@/components/CountUpAmount', () => ({ CountUpAmount: () => null }));
// The sheets aren't under test here (and pull in the keyboard controller's native module).
jest.mock('@/features/people/AddPersonModal', () => ({ AddPersonModal: () => null }));
jest.mock('@/features/people/PersonDetailModal', () => ({ PersonDetailModal: () => null }));

import PeopleScreen from '../../../app/people';

async function render() {
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = create(<PeopleScreen />);
  });
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  return tree;
}
const texts = (tree: ReactTestRenderer) =>
  tree.root.findAllByType(Text).map((t) => [].concat(t.props.children).join(''));

// Loads React Native's lazily-required components once, with a generous budget.
beforeAll(async () => {
  await render();
}, 180000);

describe('Friends & Family screen', () => {
  it('lists each person with who owes whom', async () => {
    mockPeople.current = [
      { id: 'p1', name: 'Aarav', balanceMinor: 90000, lastActivityDate: null },
      { id: 'p2', name: 'Meera', balanceMinor: -30000, lastActivityDate: null },
      { id: 'p3', name: 'Riya', balanceMinor: 0, lastActivityDate: null },
    ];
    const shown = texts(await render());
    expect(shown).toEqual(
      expect.arrayContaining(['Aarav', 'Owes you', 'Meera', 'You owe', 'Riya', 'Settled'])
    );
  });

  it('invites the first person when no one is added', async () => {
    mockPeople.current = [];
    expect(texts(await render())).toContain('No one here yet');
  });
});
