import { Profiler, useEffect } from 'react';
import { create, act, type ReactTestRenderer } from 'react-test-renderer';

/**
 * Runs a hook in a throwaway component. `result.current` is the latest value the hook returned, kept up to date from
 * an effect (so it is read after the `act` that caused the render, like everything else a test looks at).
 * `onRender` is called on every commit, to count redraws.
 */
export function renderHook<T, P = undefined>(
  useHook: (props: P) => T,
  { initialProps, onRender }: { initialProps?: P; onRender?: () => void } = {}
) {
  const result = { current: undefined as unknown as T };
  function Probe({ hookProps }: { hookProps: P }) {
    const value = useHook(hookProps);
    useEffect(() => {
      result.current = value;
    });
    return null;
  }
  const element = (hookProps: P) => (
    <Profiler id="hook" onRender={() => onRender?.()}>
      <Probe hookProps={hookProps} />
    </Profiler>
  );
  let tree!: ReactTestRenderer;
  act(() => {
    tree = create(element(initialProps as P));
  });
  return {
    result,
    rerender: (next: P) => act(() => tree.update(element(next))),
    unmount: () => act(() => tree.unmount()),
  };
}
