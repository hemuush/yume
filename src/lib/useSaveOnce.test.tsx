import { act, create } from 'react-test-renderer';
import { useSaveOnce } from './useSaveOnce';

it('shares the lock across different actions and allows retry after a rejection', async () => {
  let run!: ReturnType<typeof useSaveOnce<[() => Promise<void>]>>;
  function Harness() {
    run = useSaveOnce(async (action: () => Promise<void>) => {
      await action();
    });
    return null;
  }
  let tree!: ReturnType<typeof create>;
  act(() => {
    tree = create(<Harness />);
  });
  let reject!: (error: Error) => void;
  const first = jest.fn(
    () =>
      new Promise<void>((_, fail) => {
        reject = fail;
      })
  );
  const second = jest.fn(async () => {});
  const pending = run(first).catch((error) => error);
  await run(second);
  expect(first).toHaveBeenCalledTimes(1);
  expect(second).not.toHaveBeenCalled();
  reject(new Error('Write failed'));
  expect(await pending).toEqual(new Error('Write failed'));
  await run(second);
  expect(second).toHaveBeenCalledTimes(1);
  act(() => tree.unmount());
});
