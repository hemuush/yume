/** Search before anything is typed: things to try and past searches, each one tap to run. */
import { Text } from 'react-native';
import { create, act, ReactTestRenderer } from 'react-test-renderer';

jest.mock('@expo/vector-icons/Feather', () => () => null);
jest.mock('react-native-reanimated', () => require('@/test-support/reanimatedMock').createReanimatedMock());
jest.mock('@/theme/AccentContext', () => ({
  useAccent: () => ({ dot: '#F0876A', accent: '#8FCBFF', secondary: '#8FE8C8' }),
}));

import { SearchStatus } from './ActivityFilterChips';

const texts = (r: ReactTestRenderer) =>
  r.root.findAllByType(Text).map((t) => [t.props.children].flat(Infinity).join(''));

function render(over: Partial<React.ComponentProps<typeof SearchStatus>> = {}) {
  let r!: ReactTestRenderer;
  act(() => {
    r = create(<SearchStatus query="" minChars={2} loading={false} resultCount={0} {...over} />);
  });
  return r;
}

describe('search, before typing', () => {
  it('runs a suggestion or a past search in one tap', () => {
    const onPick = jest.fn();
    const r = render({ suggestions: ['Food', '156'], recent: ['swiggy'], onPick });
    expect(texts(r)).toEqual(
      expect.arrayContaining(['Search everything', 'Food', '156', 'Recent', 'swiggy'])
    );
    act(() =>
      r.root.find((n) => n.props.accessibilityLabel === 'Search for 156' && n.props.onPress).props.onPress()
    );
    act(() =>
      r.root
        .find((n) => n.props.accessibilityLabel === 'Search again for swiggy' && n.props.onPress)
        .props.onPress()
    );
    expect(onPick.mock.calls).toEqual([['156'], ['swiggy']]);
  });

  it('has no Recent block until something has been searched', () => {
    expect(texts(render())).not.toContain('Recent');
  });

  it('says when nothing matched', () => {
    expect(texts(render({ query: 'zzz' }))).toContain('No matches for "zzz"');
  });
});
