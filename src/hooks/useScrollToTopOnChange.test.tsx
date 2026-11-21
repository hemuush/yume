import { create, act } from 'react-test-renderer';
import { useScrollToTopOnChange } from './useScrollToTopOnChange';

function Harness({
  list,
  periodKey,
}: {
  list: { current: { scrollToOffset: jest.Mock } | null };
  periodKey: string;
}) {
  useScrollToTopOnChange(list, periodKey);
  return null;
}

it('returns the list to its top when the key changes, and not for the same key', () => {
  const scrollToOffset = jest.fn();
  const list = { current: { scrollToOffset } };
  let tree!: ReturnType<typeof create>;
  act(() => {
    tree = create(<Harness list={list} periodKey="week-2026-11-08" />);
  });
  // Showing the first period is not a change.
  expect(scrollToOffset).not.toHaveBeenCalled();
  act(() => tree.update(<Harness list={list} periodKey="week-2026-11-08" />));
  expect(scrollToOffset).not.toHaveBeenCalled();
  act(() => tree.update(<Harness list={list} periodKey="month-2026-10-01" />));
  expect(scrollToOffset).toHaveBeenCalledTimes(1);
  expect(scrollToOffset).toHaveBeenCalledWith({ offset: 0, animated: false });
  act(() => tree.unmount());
});

it('does nothing, and does not throw, before the list exists', () => {
  const list = { current: null };
  let tree!: ReturnType<typeof create>;
  act(() => {
    tree = create(<Harness list={list} periodKey="a" />);
  });
  expect(() => act(() => tree.update(<Harness list={list} periodKey="b" />))).not.toThrow();
  act(() => tree.unmount());
});
