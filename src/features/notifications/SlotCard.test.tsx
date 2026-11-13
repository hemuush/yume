import { create, act } from 'react-test-renderer';
import { StyleSheet, Text } from 'react-native';

jest.mock('@expo/vector-icons/Feather', () => () => null);
jest.mock('@/theme/AccentContext', () => ({ useAccent: () => ({ accent: '#8FCBFF' }) }));

import { SlotCard } from './SlotCard';

const mount = (minutes: number) => {
  let tree!: ReturnType<typeof create>;
  act(() => {
    tree = create(
      <SlotCard
        kind="morning"
        sub="Check-in, EMIs, alerts"
        on
        minutes={minutes}
        onToggle={jest.fn()}
        onChange={jest.fn()}
      />
    );
  });
  return tree;
};

describe('SlotCard', () => {
  it('is wide enough that two never share a phone row, so the time is never cut to "9:0…"', () => {
    const tree = mount(9 * 60);
    const card = tree.root.findByProps({ testID: 'morning-slot' });
    const style = StyleSheet.flatten(card.props.style);
    // Two cards plus the 12 dp gap must not fit in the narrowest content width of a 360 dp phone (328): side by
    // side each had about 49 dp for the clock between its two 44 dp buttons.
    expect((style.flexBasis as number) * 2 + 12).toBeGreaterThan(412 - 32);
    act(() => tree.unmount());
  });

  it('shows the time whole, and moves it half an hour either way from its two buttons', () => {
    const onChange = jest.fn();
    let tree!: ReturnType<typeof create>;
    act(() => {
      tree = create(
        <SlotCard kind="morning" sub="x" on minutes={9 * 60} onToggle={jest.fn()} onChange={onChange} />
      );
    });
    expect(
      tree.root.findAllByType(Text).some((t) => [].concat(t.props.children).join('') === '9:00 AM')
    ).toBe(true);
    const press = (label: string) =>
      act(() =>
        tree.root.find((n) => n.props.accessibilityLabel === label && n.props.onPress).props.onPress()
      );
    press('Morning time 30 minutes later');
    press('Morning time 30 minutes earlier');
    expect(onChange.mock.calls).toEqual([[9 * 60 + 30], [9 * 60 - 30]]);
    act(() => tree.unmount());
  });
});
