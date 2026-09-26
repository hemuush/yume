/**
 * Render test for Home's "Needs you" card — the same smoke-render guard
 * BudgetRow/GoalRing have (a Reanimated/core-Animated mismatch once crashed
 * release builds silently), plus the card's own contract: nothing at all
 * when there's nothing to do, a row per item, and the right callback per tap.
 */
import { create, act, ReactTestRenderer } from 'react-test-renderer';

// The first render loads React Native's component tree, which on a cold, fully
// parallel run (CI, or the whole suite at once) can take longer than Jest's
// 5s default — seen failing that way, never on its own. Generous, not slow.
jest.setTimeout(30000);
import { Text } from 'react-native';
import { NeedsYouCard } from './NeedsYouCard';
import { NeedsYouItem } from './needsYou';

const emi: NeedsYouItem = {
  key: 'emi',
  tone: 'urgent',
  title: 'Home loan EMI',
  detail: 'Due today',
  amountMinor: 987000,
  action: 'loans',
};
const noBackup: NeedsYouItem = {
  key: 'backup-none',
  tone: 'info',
  title: 'No backup yet',
  detail: 'Your data only lives on this phone',
  action: 'backup',
  snoozable: true,
};

// Async so the icon font's own load (a state update inside @expo/vector-icons)
// settles inside act, rather than warning after the test has moved on.
async function render(items: NeedsYouItem[], onOpen = jest.fn(), onSnooze = jest.fn()) {
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = create(<NeedsYouCard items={items} onOpen={onOpen} onSnooze={onSnooze} />);
  });
  return tree;
}

const texts = (tree: ReactTestRenderer) =>
  tree.root.findAllByType(Text).map((t) => [].concat(t.props.children).join(''));

// Loads React Native's lazily-required components once, up front, with a
// generous budget — on a cold, fully parallel run (CI) their first load can
// outlast a single test's time limit, which failed this file intermittently.
beforeAll(async () => {
  await render([emi, noBackup]);
}, 180000);

describe('NeedsYouCard', () => {
  it('renders nothing when there is nothing to do', async () => {
    expect((await render([])).toJSON()).toBeNull();
  });

  it('renders a titled row for each item', async () => {
    const shown = texts(await render([emi, noBackup]));
    expect(shown).toEqual(
      expect.arrayContaining(['Needs you', 'Home loan EMI', 'Due today', 'No backup yet', 'Later'])
    );
  });

  it('opens an item when its row is tapped, and snoozes only via "Later"', async () => {
    const onOpen = jest.fn();
    const onSnooze = jest.fn();
    const tree = await render([emi, noBackup], onOpen, onSnooze);

    const row = tree.root.find(
      (n) => n.props.accessibilityLabel?.startsWith('Home loan EMI') && n.props.onPress
    );
    act(() => row.props.onPress());
    expect(onOpen).toHaveBeenCalledWith(emi);

    const later = tree.root.find((n) => n.props.accessibilityLabel === 'Remind me later' && n.props.onPress);
    act(() => later.props.onPress());
    expect(onSnooze).toHaveBeenCalledWith(noBackup);
    expect(onOpen).toHaveBeenCalledTimes(1);
  });
});
