import { create, act } from 'react-test-renderer';
import { Text } from 'react-native';

jest.mock('react-native-reanimated', () => require('@/test-support/reanimatedMock').createReanimatedMock());
jest.mock('@/theme/AccentContext', () => ({ useAccent: () => ({ accent: '#8FCBFF' }) }));

import { LinkTiles } from './LinkTiles';

const labels = (entries: number, loans: number, friends: number) => {
  let tree!: ReturnType<typeof create>;
  act(() => {
    tree = create(
      <LinkTiles
        entries={entries}
        loans={loans}
        friends={friends}
        onEntries={jest.fn()}
        onLoans={jest.fn()}
        onFriends={jest.fn()}
      />
    );
  });
  const out = tree.root.findAllByType(Text).map((t) => [].concat(t.props.children).join(''));
  const spoken = tree.root
    .findAll((n) => typeof n.props.accessibilityLabel === 'string' && typeof n.props.onPress === 'function')
    .map((n) => n.props.accessibilityLabel as string);
  act(() => tree.unmount());
  return { out, spoken };
};

describe('LinkTiles', () => {
  it('names one of each in the singular, on screen and to a screen reader', () => {
    const { out, spoken } = labels(1, 1, 1);
    expect(out).toEqual(['1', 'Entry', '1', 'Active loan', '1', 'Friend']);
    expect(spoken).toEqual(['1 Entry', '1 Active loan', '1 Friend']);
  });

  it('names none and many in the plural', () => {
    expect(labels(0, 0, 0).spoken).toEqual(['0 Entries', '0 Active loans', '0 Friends']);
    expect(labels(284, 3, 12).spoken).toEqual(['284 Entries', '3 Active loans', '12 Friends']);
  });
});
