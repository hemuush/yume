import { act, create, ReactTestRenderer } from 'react-test-renderer';
import { Text } from 'react-native';
import { SwitchRow } from './SwitchRow';
import { ToggleSwitch } from './ToggleSwitch';

jest.mock('react-native-reanimated', () => require('@/test-support/reanimatedMock').createReanimatedMock());

describe('SwitchRow', () => {
  it('shows the setting, what it does and a switch labelled with the title', () => {
    const onChange = jest.fn();
    let tree!: ReactTestRenderer;
    act(() => {
      tree = create(
        <SwitchRow title="Track its value" hint="Update what it is worth." value onChange={onChange} />
      );
    });
    const shown = tree.root.findAllByType(Text).map((t) => t.props.children);
    expect(shown).toEqual(['Track its value', 'Update what it is worth.']);
    const toggle = tree.root.findByType(ToggleSwitch);
    expect(toggle.props.accessibilityLabel).toBe('Track its value');
    expect(toggle.props.value).toBe(true);
    act(() => toggle.props.onChange(false));
    expect(onChange).toHaveBeenCalledWith(false);
    act(() => tree.unmount());
  });
});
