import { Text } from 'react-native';
import { act, create } from 'react-test-renderer';
import { createValueStore, useStoreValue } from './valueStore';

describe('createValueStore', () => {
  it('holds a value, takes a new one or a function of the old one, and tells its listeners', () => {
    const store = createValueStore(1);
    const heard = jest.fn();
    const stop = store.subscribe(heard);
    store.set(2);
    store.set((n) => n + 1);
    expect(store.get()).toBe(3);
    expect(heard).toHaveBeenCalledTimes(2);
    stop();
    store.set(4);
    expect(heard).toHaveBeenCalledTimes(2);
  });

  it('says nothing when the value is the same', () => {
    const open = { id: 'a' };
    const store = createValueStore<{ id: string } | null>(open);
    const heard = jest.fn();
    store.subscribe(heard);
    store.set(open);
    store.set((prev) => prev);
    expect(heard).not.toHaveBeenCalled();
  });
});

describe('useStoreValue', () => {
  it('draws only the component that reads the store when the value changes', () => {
    const store = createValueStore('closed');
    let outer = 0;
    let reader = 0;
    function Reader() {
      reader++;
      return <Text>{useStoreValue(store)}</Text>;
    }
    function Page() {
      outer++;
      return <Reader />;
    }
    let tree!: ReturnType<typeof create>;
    act(() => {
      tree = create(<Page />);
    });
    act(() => store.set('open'));
    expect(tree.root.findByType(Text).props.children).toBe('open');
    expect(outer).toBe(1);
    expect(reader).toBe(2);
  });
});
