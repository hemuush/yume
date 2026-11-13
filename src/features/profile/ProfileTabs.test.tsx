import { create, act } from 'react-test-renderer';
import { StyleSheet, Text } from 'react-native';

jest.mock('@/theme/AccentContext', () => ({ useAccent: () => ({ accent: '#8FCBFF' }) }));

import { ProfileTabs } from './ProfileTabs';

describe('ProfileTabs', () => {
  it('writes the picked tab and the other in the same weight, so switching never changes the width of a word', () => {
    let tree!: ReturnType<typeof create>;
    const weights = () =>
      tree.root.findAllByType(Text).map((t) => StyleSheet.flatten(t.props.style).fontFamily);
    act(() => {
      tree = create(<ProfileTabs value="you" onChange={jest.fn()} />);
    });
    const before = weights();
    expect(new Set(before).size).toBe(1);
    act(() => tree.update(<ProfileTabs value="settings" onChange={jest.fn()} />));
    expect(weights()).toEqual(before);
    act(() => tree.unmount());
  });

  it('marks the picked tab for a screen reader and reports a tap', () => {
    const onChange = jest.fn();
    let tree!: ReturnType<typeof create>;
    act(() => {
      tree = create(<ProfileTabs value="you" onChange={onChange} />);
    });
    const tabs = tree.root
      .findAll((n) => n.props.accessibilityRole === 'tab' && typeof n.props.onPress === 'function')
      .filter((n, i, all) => all.findIndex((m) => m.props.onPress === n.props.onPress) === i);
    expect(tabs.map((t) => t.props.accessibilityState.selected)).toEqual([true, false]);
    act(() => tabs[1].props.onPress());
    expect(onChange).toHaveBeenCalledWith('settings');
    act(() => tree.unmount());
  });
});
