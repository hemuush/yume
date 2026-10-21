import { act, create, ReactTestRenderer } from 'react-test-renderer';
import { useSheetMutation } from './useSheetMutation';
import { useEffect } from 'react';

let current!: ReturnType<typeof useSheetMutation>;
function Sheet() {
  const value = useSheetMutation();
  useEffect(() => {
    current = value;
  }, [value]);
  return null;
}
async function mount() {
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = create(<Sheet />);
  });
  return tree;
}

it('holds the lock through refresh and never replays a committed write after refresh failure', async () => {
  const tree = await mount();
  const write = jest.fn(async () => 'snapshot');
  const refresh = jest.fn(async () => {
    throw new Error('refresh failed');
  });
  const run = current.run;
  await act(async () => {
    await Promise.all([run(write, refresh), run(write, refresh)]);
    await run(write, refresh);
  });
  expect(write).toHaveBeenCalledTimes(1);
  expect(refresh).toHaveBeenCalledTimes(1);
  expect(current.saved).toBe(true);
  expect(current.error).toContain('was saved');
  act(() => tree.unmount());
});

it('permits retry after a write failure', async () => {
  const tree = await mount();
  const write = jest.fn().mockRejectedValueOnce(new Error('busy')).mockResolvedValueOnce('saved');
  const refresh = jest.fn();
  await act(async () => {
    await current.run(write, refresh);
  });
  expect(current.saved).toBe(false);
  expect(current.error).toBe('busy');
  await act(async () => {
    await current.run(write, refresh);
  });
  expect(refresh).toHaveBeenCalledWith('saved');
  act(() => tree.unmount());
});

it('ignores late completion and stale callbacks after a sheet unmounts', async () => {
  const tree = await mount();
  let finish!: () => void;
  const write = jest.fn(
    () =>
      new Promise<void>((resolve) => {
        finish = resolve;
      })
  );
  const refresh = jest.fn();
  const run = current.run;
  let pending!: Promise<void>;
  act(() => {
    pending = run(write, refresh);
  });
  act(() => tree.unmount());
  await act(async () => {
    finish();
    await pending;
    await run(write, refresh);
  });
  expect(write).toHaveBeenCalledTimes(1);
  expect(refresh).not.toHaveBeenCalled();
});
