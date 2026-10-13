import { act, create, ReactTestRenderer } from 'react-test-renderer';
import { LockScreen } from './LockScreen';
import { PrimaryButton } from './PrimaryButton';
import { authenticate, isDeviceSecured } from '@/lib/appLock';

jest.mock('@/lib/appLock', () => ({ authenticate: jest.fn(), isDeviceSecured: jest.fn() }));
jest.mock('@/lib/AppLockContext', () => ({ useAppLock: () => ({ setLockEnabled: jest.fn() }) }));
jest.mock('react-native-reanimated', () => require('@/test-support/reanimatedMock').createReanimatedMock());
jest.mock('./SuuIllustration', () => ({ SuuIllustration: () => null }));
jest.mock('./YumeLogo', () => ({ YumeLogo: () => null }));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('@/features/home/HeaderHills', () => ({ HeaderHills: () => null }));

const auth = authenticate as jest.Mock;
const secured = isDeviceSecured as jest.Mock;
let tree: ReactTestRenderer;
const render = async (onUnlocked = jest.fn()) => {
  await act(async () => {
    tree = create(<LockScreen onUnlocked={onUnlocked} />);
  });
  return onUnlocked;
};
const unlock = async () => {
  await act(async () => {
    await tree.root.findAllByType(PrimaryButton)[0].props.onPress();
  });
};
afterEach(() => {
  act(() => tree?.unmount());
  jest.resetAllMocks();
});

it('stays locked when both authentication and the security check fail', async () => {
  auth.mockRejectedValue(new Error('native error'));
  secured.mockRejectedValue(new Error('security status unavailable'));
  const unlocked = await render();
  await unlock();
  expect(unlocked).not.toHaveBeenCalled();
  expect(tree.root.findAllByType(PrimaryButton).map((button) => button.props.title)).toEqual(['Unlock']);
});

it('offers recovery only when Android explicitly confirms no device lock', async () => {
  auth.mockResolvedValue(false);
  secured.mockResolvedValue(false);
  await render();
  await unlock();
  expect(tree.root.findAllByType(PrimaryButton).map((button) => button.props.title)).toContain(
    "Turn off Yume's lock"
  );
});

it('does not open a system prompt until Unlock is tapped', async () => {
  const unlocked = await render();
  expect(auth).not.toHaveBeenCalled();
  expect(secured).not.toHaveBeenCalled();
  expect(unlocked).not.toHaveBeenCalled();
  expect(tree.root.findAllByType(PrimaryButton).map((button) => button.props.title)).toEqual(['Unlock']);
});

it('does not start a second prompt while a user-requested prompt is pending', async () => {
  let finish!: (ok: boolean) => void;
  auth.mockImplementation(
    () =>
      new Promise<boolean>((resolve) => {
        finish = resolve;
      })
  );
  secured.mockResolvedValue(true);
  const unlocked = await render();
  act(() => {
    void tree.root.findByType(PrimaryButton).props.onPress();
  });
  await act(async () => {
    tree.root.findByType(PrimaryButton).props.onPress();
  });
  expect(auth).toHaveBeenCalledTimes(1);
  await act(async () => {
    finish(true);
  });
  expect(unlocked).toHaveBeenCalledTimes(1);
});

it('stays locked after dismissal and allows a successful manual retry', async () => {
  auth.mockResolvedValueOnce(false).mockResolvedValueOnce(true);
  secured.mockResolvedValue(true);
  const unlocked = await render();
  await unlock();
  expect(unlocked).not.toHaveBeenCalled();
  expect(auth).toHaveBeenCalledTimes(1);
  await unlock();
  expect(unlocked).toHaveBeenCalledTimes(1);
  expect(auth).toHaveBeenCalledTimes(2);
});
