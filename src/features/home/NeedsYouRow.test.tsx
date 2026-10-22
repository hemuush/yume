/**
 * Needs you row on the bell screen: smoke-render guard (a Reanimated/core-Animated mismatch once crashed).
 * Contract: title/detail, a verb button, "Later" (menu) only if snoozable, dismiss only if dismissible.
 */
import { create, act, ReactTestRenderer } from 'react-test-renderer';

// First render loads RN's component tree, which can top Jest's 5s default on a cold parallel run (CI).
// Generous, not slow.
jest.setTimeout(30000);
import { Text } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { NeedsYouRow } from './NeedsYouRow';
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
async function render(
  item: NeedsYouItem,
  opts: { onPress?: jest.Mock; onSnooze?: jest.Mock; onDismiss?: jest.Mock } = {}
) {
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = create(
      <NeedsYouRow
        item={item}
        divider={false}
        onPress={opts.onPress ?? jest.fn()}
        onSnooze={opts.onSnooze ?? jest.fn()}
        onDismiss={opts.onDismiss}
      />
    );
  });
  return tree;
}

const texts = (tree: ReactTestRenderer) =>
  tree.root.findAllByType(Text).map((t) => [].concat(t.props.children).join(''));

// Preloads RN's lazily-required components once with a generous budget: on a cold parallel run (CI) their
// first load can outlast one test's time limit and fail this file intermittently.
beforeAll(async () => {
  await render(emi);
}, 180000);

describe('NeedsYouRow', () => {
  it('uses the suggestion currency in visible and spoken amounts', async () => {
    const tree = await render({ ...emi, currency: 'USD', amountMinor: 10000 });
    expect(texts(tree)).toContain('$100');
    expect(
      tree.root
        .findAll((n) => typeof n.props.accessibilityLabel === 'string')
        .some((n) => n.props.accessibilityLabel.includes('$100'))
    ).toBe(true);
  });
  it('shows the title and detail', async () => {
    expect(texts(await render(emi))).toEqual(expect.arrayContaining(['Home loan EMI', 'Due today']));
  });

  it('opens the item when its row is tapped', async () => {
    const onPress = jest.fn();
    const tree = await render(emi, { onPress });
    act(() =>
      tree.root
        .find((n) => n.props.accessibilityLabel?.startsWith('Home loan EMI') && n.props.onPress)
        .props.onPress()
    );
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  const openMenu = (tree: ReactTestRenderer, title: string) =>
    act(() =>
      tree.root
        .find((n) => n.props.accessibilityLabel === `More for ${title}` && n.props.onPress)
        .props.onPress()
    );

  it('says in one word what the row does, and tapping it opens the item', async () => {
    const onPress = jest.fn();
    const tree = await render(emi, { onPress });
    expect(texts(tree)).toContain('Pay');
    act(() =>
      tree.root
        .find((n) => n.props.accessibilityLabel === 'Pay: Home loan EMI' && n.props.onPress)
        .props.onPress()
    );
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('offers "Later" in the menu only on a snoozable item, and it does not open the item', async () => {
    const plain = await render(emi, { onDismiss: jest.fn() });
    openMenu(plain, 'Home loan EMI');
    expect(texts(plain)).not.toContain('Later');
    const onPress = jest.fn();
    const onSnooze = jest.fn();
    const tree = await render(noBackup, { onPress, onSnooze, onDismiss: jest.fn() });
    expect(texts(tree)).not.toContain('Later');
    openMenu(tree, 'No backup yet');
    expect(texts(tree)).toContain('Later');
    act(() =>
      tree.root
        .find((n) => n.props.accessibilityLabel === 'Remind me later' && n.props.onPress)
        .props.onPress()
    );
    expect(onSnooze).toHaveBeenCalledTimes(1);
    expect(onPress).not.toHaveBeenCalled();
  });

  it('shows Dismiss in the menu only when it can be dismissed', async () => {
    const dismissButtons = (tree: ReactTestRenderer) =>
      tree.root.findAll((n) => n.props.accessibilityLabel === 'Dismiss: Home loan EMI' && n.props.onPress);
    const none = await render(emi);
    openMenu(none, 'Home loan EMI');
    expect(dismissButtons(none)).toHaveLength(0);
    const onDismiss = jest.fn();
    const tree = await render(emi, { onDismiss });
    expect(dismissButtons(tree)).toHaveLength(0);
    openMenu(tree, 'Home loan EMI');
    act(() => dismissButtons(tree)[0].props.onPress());
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('shows "Show again" instead of the menu on a dismissed row', async () => {
    const onDismiss = jest.fn();
    let tree!: ReactTestRenderer;
    await act(async () => {
      tree = create(
        <NeedsYouRow
          item={emi}
          divider={false}
          onPress={jest.fn()}
          onSnooze={jest.fn()}
          onDismiss={onDismiss}
          dismissLabel="Show again"
        />
      );
    });
    expect(texts(tree)).toContain('Show again');
    act(() =>
      tree.root
        .find((n) => n.props.accessibilityLabel === 'Show again: Home loan EMI' && n.props.onPress)
        .props.onPress()
    );
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('draws the icon of what the item is about, whatever its tone', async () => {
    const iconOf = async (item: NeedsYouItem) =>
      (await render(item)).root.findAllByType(Feather)[0].props.name;
    const soon = (over: Partial<NeedsYouItem>): NeedsYouItem => ({ ...emi, tone: 'warn', ...over });
    expect(await iconOf(soon({ action: 'loans' }))).toBe('calendar');
    expect(await iconOf(soon({ action: 'payCard' }))).toBe('credit-card');
    // Budgets have no icon of their own, so they keep the warn tone's pie chart.
    expect(await iconOf(soon({ action: 'budgets' }))).toBe('pie-chart');
  });
});
