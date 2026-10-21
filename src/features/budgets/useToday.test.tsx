import { act, create } from 'react-test-renderer';
import { AppState, Text } from 'react-native';
import { useToday } from './useToday';

function Day() {
  return <Text>{useToday()}</Text>;
}

it('shares one native subscription and changes month at local midnight', () => {
  jest.useFakeTimers();
  jest.setSystemTime(new Date(2026, 0, 31, 23, 59, 59));
  const remove = jest.fn();
  const spy = jest.spyOn(AppState, 'addEventListener').mockReturnValue({ remove });
  let tree!: ReturnType<typeof create>;
  act(() => {
    tree = create(
      <>
        <Day />
        <Day />
      </>
    );
  });
  expect(spy).toHaveBeenCalledTimes(1);
  act(() => jest.advanceTimersByTime(1100));
  expect(tree.root.findAllByType(Text).map((n) => n.props.children)).toEqual(['2026-02-01', '2026-02-01']);
  act(() => tree.unmount());
  expect(remove).toHaveBeenCalledTimes(1);
  spy.mockRestore();
  jest.useRealTimers();
});

it('rereads the device date on resume even when the background event was missed', () => {
  jest.useFakeTimers();
  jest.setSystemTime(new Date(2026, 4, 1, 12));
  let change!: Parameters<typeof AppState.addEventListener>[1];
  const spy = jest.spyOn(AppState, 'addEventListener').mockImplementation((_event, listener) => {
    change = listener;
    return { remove: jest.fn() };
  });
  let tree!: ReturnType<typeof create>;
  act(() => {
    tree = create(<Day />);
  });
  act(() => {
    jest.setSystemTime(new Date(2026, 4, 2, 12));
    change('active');
  });
  expect(tree.root.findByType(Text).props.children).toBe('2026-05-02');
  act(() => tree.unmount());
  spy.mockRestore();
  jest.useRealTimers();
});
