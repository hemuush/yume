/** The loan form's two small controls: the either/or option cards and the count stepper (kept between 0 and max). */
import { create, act, ReactTestRenderer } from 'react-test-renderer';

jest.mock('@expo/vector-icons/MaterialCommunityIcons', () => () => null);
jest.mock('@/lib/haptics', () => ({ haptics: { tap: jest.fn() } }));
jest.mock('@/theme/AccentContext', () => ({
  useAccent: () => ({ accent: '#8FCBFF', secondary: '#8FE8C8' }),
}));

import { OptionCards, CountStepper } from './AddLoanParts';
import { haptics } from '@/lib/haptics';

const press = (r: ReactTestRenderer, label: string) =>
  act(() =>
    r.root
      .find((n) => n.props.accessibilityLabel === label && typeof n.props.onPress === 'function')
      .props.onPress()
  );
const disabled = (r: ReactTestRenderer, label: string) =>
  r.root.find((n) => n.props.accessibilityLabel === label && typeof n.props.onPress === 'function').props
    .disabled;

describe('CountStepper', () => {
  const stepper = (value: number, max = 5) => {
    const onChange = jest.fn();
    let r!: ReactTestRenderer;
    act(() => {
      r = create(<CountStepper value={value} max={max} onChange={onChange} label="installments" />);
    });
    return { r, onChange };
  };

  it('steps by one with a tap of feedback', () => {
    const { r, onChange } = stepper(2);
    press(r, 'More installments');
    expect(onChange).toHaveBeenLastCalledWith(3);
    press(r, 'Fewer installments');
    expect(onChange).toHaveBeenLastCalledWith(1);
    expect(haptics.tap).toHaveBeenCalledTimes(2);
    act(() => r.unmount());
  });

  it('never goes below zero or above the maximum, and turns the button off at each end', () => {
    const low = stepper(0);
    expect(disabled(low.r, 'Fewer installments')).toBe(true);
    expect(disabled(low.r, 'More installments')).toBe(false);
    press(low.r, 'Fewer installments');
    expect(low.onChange).not.toHaveBeenCalled();
    act(() => low.r.unmount());
    const high = stepper(5);
    expect(disabled(high.r, 'More installments')).toBe(true);
    press(high.r, 'More installments');
    expect(high.onChange).not.toHaveBeenCalled();
    act(() => high.r.unmount());
  });

  it('pulls a value that is already past the maximum back to it, never beyond', () => {
    const { r, onChange } = stepper(9, 5);
    press(r, 'Fewer installments');
    expect(onChange).toHaveBeenCalledWith(5);
    act(() => r.unmount());
  });
});

describe('OptionCards', () => {
  it.each([
    [1, 'row', 1],
    [2, 'column', undefined],
  ])(
    'at text scale %s sits %s, each card sharing the row only when side by side',
    (scale, direction, flex) => {
      const spy = jest.spyOn(require('@/lib/useFontScale'), 'useFontScale').mockReturnValue(scale);
      const { StyleSheet } = require('react-native');
      let r!: ReactTestRenderer;
      act(() => {
        r = create(
          <OptionCards
            value="borrowed"
            onChange={jest.fn()}
            options={[
              { value: 'borrowed', title: 'I borrowed', sub: 'You owe it', icon: 'arrow-down' },
              { value: 'lent', title: 'I lent', sub: 'They owe you', icon: 'arrow-up' },
            ]}
          />
        );
      });
      const radio = r.root.findAll((n) => n.props.accessibilityRole === 'radio' && n.props.onPress)[0];
      const card = StyleSheet.flatten(radio.props.style({ pressed: false }));
      const row = StyleSheet.flatten(radio.parent!.props.style);
      expect(row.flexDirection).toBe(direction);
      expect(card.flex).toBe(flex);
      act(() => r.unmount());
      spy.mockRestore();
    }
  );

  it('marks the chosen option and reports a different pick', () => {
    const onChange = jest.fn();
    let r!: ReactTestRenderer;
    act(() => {
      r = create(
        <OptionCards
          value="borrowed"
          onChange={onChange}
          options={[
            { value: 'borrowed', title: 'I borrowed', sub: 'You owe it', icon: 'arrow-down' },
            { value: 'lent', title: 'I lent', sub: 'They owe you', icon: 'arrow-up' },
          ]}
        />
      );
    });
    const radios = r.root.findAll((n) => n.props.accessibilityRole === 'radio' && n.props.onPress);
    expect(radios.map((n) => n.props.accessibilityState.selected)).toEqual([true, false]);
    act(() => radios[1].props.onPress());
    expect(onChange).toHaveBeenCalledWith('lent');
    act(() => r.unmount());
  });
});
