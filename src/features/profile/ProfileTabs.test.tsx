import { create, act } from 'react-test-renderer';

jest.mock('@/theme/AccentContext', () => ({ useAccent: () => ({ accent: '#8FCBFF' }) }));

import { ProfileTabs } from './ProfileTabs';

describe('ProfileTabs', () => {
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
