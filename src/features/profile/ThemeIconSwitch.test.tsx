/** The Theme page's "Match the app icon" switch: shown only with native support, confirms before turning on. */
import { create, act, ReactTestRenderer } from 'react-test-renderer';

jest.mock('react-native-reanimated', () => require('@/test-support/reanimatedMock').createReanimatedMock());
jest.mock('@/components/AppHeader', () => ({ HeaderUserButton: () => null }));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('@/theme/AccentContext', () => ({
  useAccent: () => ({
    accent: '#A6B4F2',
    secondary: '#8FE8C8',
    themeId: 'hollowViolet',
    setTheme: jest.fn(),
  }),
}));
const mockSupported = jest.fn();
jest.mock('@/lib/appIcon', () => ({ appIconSupported: () => mockSupported() }));
const mockSet = jest.fn();
const mockGet = jest.fn();
jest.mock('@/db/settings', () => ({
  getThemeIconFollows: () => mockGet(),
  setThemeIconFollows: (v: boolean) => mockSet(v),
}));
const mockAlert = jest.fn();
jest.mock('@/components/AppDialog', () => ({ showAlert: (...a: unknown[]) => mockAlert(...a) }));

import ThemesScreen from '../../../app/themes';

async function render() {
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = create(<ThemesScreen />);
  });
  return tree;
}
const toggle = (tree: ReactTestRenderer) =>
  tree.root.findAll((n) => n.props.accessibilityLabel === 'Match the app icon' && n.props.onChange)[0];

beforeEach(() => {
  mockSupported.mockReturnValue(true);
  mockSet.mockResolvedValue(undefined);
  mockGet.mockResolvedValue(false);
});

describe('Match the app icon', () => {
  it('explains a read failure and retries instead of offering an invented setting', async () => {
    mockGet.mockRejectedValueOnce(new Error('read failed'));
    const tree = await render();
    expect(toggle(tree).props.disabled).toBe(true);
    expect(
      tree.root.findAll((node) => node.props.children === "Couldn't load the app icon setting.").length
    ).toBeGreaterThan(0);
    const retry = tree.root.findAll(
      (node) => node.props.onPress && node.props.title === 'Retry app icon setting'
    )[0];
    await act(async () => retry.props.onPress());
    expect(toggle(tree).props.disabled).toBe(false);
    act(() => tree.unmount());
  });

  it('serializes rapid saves before the disabled state rerenders', async () => {
    const tree = await render();
    const change = toggle(tree).props.onChange;
    let release!: () => void;
    mockSet.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          release = resolve;
        })
    );
    await act(async () => {
      change(false);
      change(false);
    });
    expect(mockSet).toHaveBeenCalledTimes(1);
    await act(async () => release());
    act(() => tree.unmount());
  });

  it('is hidden without native support', async () => {
    mockSupported.mockReturnValue(false);
    expect(toggle(await render())).toBeUndefined();
  });

  it('asks first when turning on, and saves only on confirm', async () => {
    const tree = await render();
    await act(async () => toggle(tree).props.onChange(true));
    expect(mockSet).not.toHaveBeenCalled();
    const buttons = mockAlert.mock.calls[0][2] as { text: string; onPress?: () => void }[];
    await act(async () => buttons.find((b) => b.text === 'Match icon')!.onPress!());
    expect(mockSet).toHaveBeenCalledWith(true);
  });

  it('turns off without asking', async () => {
    const tree = await render();
    await act(async () => toggle(tree).props.onChange(false));
    expect(mockAlert).not.toHaveBeenCalled();
    expect(mockSet).toHaveBeenCalledWith(false);
  });
});
