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
jest.mock('@/db/settings', () => ({
  getThemeIconFollows: () => Promise.resolve(false),
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
});

describe('Match the app icon', () => {
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
