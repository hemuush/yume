/**
 * AmountField: numbers are typed on Yume's own pad docked under the content, not the phone keyboard.
 * Focus opens the pad, its keys edit the text, blur or Done closes it.
 */
import { useState } from 'react';
import { create, act, ReactTestRenderer } from 'react-test-renderer';
import { Keyboard } from 'react-native';

jest.setTimeout(30000);

jest.mock('react-native-reanimated', () => require('@/test-support/reanimatedMock').createReanimatedMock());
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

import { AmountField, AmountPadDock } from './AmountField';

function Harness({
  decimal,
  maxLength,
  initial = '',
}: {
  decimal?: boolean;
  maxLength?: number;
  initial?: string;
}) {
  const [value, setValue] = useState(initial);
  return (
    <AmountPadDock>
      {() => (
        <AmountField
          label="Amount"
          value={value}
          onChangeText={setValue}
          placeholder="0.00"
          decimal={decimal}
          maxLength={maxLength}
        />
      )}
    </AmountPadDock>
  );
}

async function render(props: React.ComponentProps<typeof Harness> = {}) {
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = create(<Harness {...props} />);
  });
  return tree;
}

const input = (tree: ReactTestRenderer) =>
  tree.root.find((n) => typeof n.type === 'string' && n.props.placeholder === '0.00');
const keyOf = (tree: ReactTestRenderer, label: string) =>
  tree.root.findAll((n) => n.props.accessibilityLabel === label && typeof n.props.onPress === 'function');
const press = async (tree: ReactTestRenderer, label: string) => {
  await act(async () => {
    keyOf(tree, label)[0].props.onPress();
  });
};
const focus = async (tree: ReactTestRenderer) => {
  await act(async () => {
    input(tree).props.onFocus({});
  });
};

describe('AmountField', () => {
  it('keeps the phone keyboard closed', async () => {
    const tree = await render();
    expect(input(tree).props.showSoftInputOnFocus).toBe(false);
  });

  it('docks the pad on focus and takes it away on blur', async () => {
    const tree = await render();
    expect(keyOf(tree, '7')).toHaveLength(0);
    await focus(tree);
    expect(keyOf(tree, '7').length).toBeGreaterThan(0);
    await act(async () => {
      input(tree).props.onBlur({});
    });
    expect(keyOf(tree, '7')).toHaveLength(0);
  });

  it('types digits and a decimal point, and backspaces', async () => {
    const tree = await render();
    await focus(tree);
    for (const k of ['1', '2', 'decimal point', '5']) await press(tree, k);
    expect(input(tree).props.value).toBe('12.5');
    await press(tree, 'delete');
    expect(input(tree).props.value).toBe('12.');
  });

  it('continues from what the field already holds', async () => {
    const tree = await render({ initial: '450' });
    await focus(tree);
    await press(tree, '0');
    expect(input(tree).props.value).toBe('4500');
  });

  it('clears the whole amount on a long press of backspace', async () => {
    const tree = await render({ initial: '4500' });
    await focus(tree);
    await act(async () => {
      keyOf(tree, 'delete')[0].props.onLongPress();
    });
    expect(input(tree).props.value).toBe('');
  });

  it('has no decimal point for whole numbers', async () => {
    const tree = await render({ decimal: false });
    await focus(tree);
    expect(keyOf(tree, 'decimal point')).toHaveLength(0);
    for (const k of ['6', '0']) await press(tree, k);
    expect(input(tree).props.value).toBe('60');
  });

  it('stops at maxLength', async () => {
    const tree = await render({ maxLength: 2, decimal: false });
    await focus(tree);
    for (const k of ['1', '2', '3']) await press(tree, k);
    expect(input(tree).props.value).toBe('12');
    await press(tree, 'delete');
    expect(input(tree).props.value).toBe('1');
  });

  it('closes the pad with Done', async () => {
    const dismiss = jest.spyOn(Keyboard, 'dismiss').mockImplementation(() => {});
    const tree = await render();
    await focus(tree);
    await act(async () => {
      tree.root
        .find((n) => n.props.title === 'Done' && typeof n.props.onPress === 'function')
        .props.onPress();
    });
    expect(dismiss).toHaveBeenCalled();
  });

  it('cancels the pending scroll when the sheet goes away', async () => {
    jest.useFakeTimers();
    const set = jest.spyOn(globalThis, 'setTimeout');
    const clear = jest.spyOn(globalThis, 'clearTimeout');
    try {
      const tree = await render();
      await focus(tree);
      const call = set.mock.calls.findIndex(([, ms]) => ms === 120);
      expect(call).toBeGreaterThanOrEqual(0);
      const timerId = set.mock.results[call].value;
      await act(async () => {
        tree.unmount();
      });
      expect(clear).toHaveBeenCalledWith(timerId);
    } finally {
      set.mockRestore();
      clear.mockRestore();
      jest.useRealTimers();
    }
  });

  it('falls back to a numeric keyboard outside a host', async () => {
    let tree!: ReactTestRenderer;
    await act(async () => {
      tree = create(<AmountField label="Amount" value="" onChangeText={() => {}} placeholder="0.00" />);
    });
    expect(input(tree).props.keyboardType).toBe('decimal-pad');
  });
});
