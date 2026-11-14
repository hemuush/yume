/** Which stacked lines are open, kept outside React state so that opening one re-renders only that line. */
import { Text } from 'react-native';
import { create, act } from 'react-test-renderer';
import { createStackStore, useStackOpen, type StackStore } from './stackStore';

describe('createStackStore', () => {
  it('starts with the given stacks open, and toggles one open and closed', () => {
    const stacks = createStackStore(['a']);
    expect(stacks.has('a')).toBe(true);
    expect(stacks.has('b')).toBe(false);
    stacks.toggle('b');
    stacks.toggle('a');
    expect([stacks.has('a'), stacks.has('b')]).toEqual([false, true]);
  });

  it('tells subscribers when something toggles, and stops once they unsubscribe', () => {
    const stacks = createStackStore();
    const listener = jest.fn();
    const off = stacks.subscribe(listener);
    stacks.toggle('a');
    expect(listener).toHaveBeenCalledTimes(1);
    off();
    stacks.toggle('a');
    expect(listener).toHaveBeenCalledTimes(1);
  });
});

describe('useStackOpen', () => {
  const renders: Record<string, number> = { a: 0, b: 0 };
  function Line({ stacks, id }: { stacks: StackStore; id: string }) {
    renders[id]++;
    return <Text>{`${id}:${useStackOpen(stacks, id) ? 'open' : 'closed'}`}</Text>;
  }

  it('re-renders only the stack that opened or closed', () => {
    renders.a = renders.b = 0;
    const stacks = createStackStore();
    let tree!: ReturnType<typeof create>;
    act(() => {
      tree = create(
        <>
          <Line stacks={stacks} id="a" />
          <Line stacks={stacks} id="b" />
        </>
      );
    });
    const text = () => tree.root.findAllByType(Text).map((t) => t.props.children);
    expect(text()).toEqual(['a:closed', 'b:closed']);
    act(() => stacks.toggle('b'));
    expect(text()).toEqual(['a:closed', 'b:open']);
    // Line a's body ran once (its first render): opening b did not run it again.
    expect(renders).toEqual({ a: 1, b: 2 });
    act(() => tree.unmount());
  });

  it('keeps a stack open across a line leaving the screen and coming back', () => {
    const stacks = createStackStore();
    stacks.toggle('a');
    let tree!: ReturnType<typeof create>;
    act(() => {
      tree = create(<Line stacks={stacks} id="a" />);
    });
    act(() => tree.unmount());
    act(() => {
      tree = create(<Line stacks={stacks} id="a" />);
    });
    expect(tree.root.findByType(Text).props.children).toBe('a:open');
    act(() => tree.unmount());
  });
});
