import { StyleSheet, Text } from 'react-native';
import { act, create, ReactTestRenderer } from 'react-test-renderer';

jest.mock('react-native-reanimated', () => require('@/test-support/reanimatedMock').createReanimatedMock());
jest.mock('@/lib/useReduceMotion', () => ({ useReduceMotion: () => false }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) }));
jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
jest.mock('@/theme/AccentContext', () => ({
  useAccent: () => ({ accent: '#8FCBFF', secondary: '#8FE8C8' }),
}));
jest.mock('@/components/AppHeader', () => ({ HeaderIconButton: () => null, HeaderUserButton: () => null }));
jest.mock('./SkyBackdrop', () => ({ SkyBackdrop: () => null }));
jest.mock('./MonthPill', () => ({ MonthPill: () => null }));
jest.mock('./WrapButton', () => ({ WrapButton: () => null }));
jest.mock('@/components/YumeLogo', () => ({ YumeLogo: () => null }));

import { HomeHeader } from './HomeHeader';

function render(over: Partial<React.ComponentProps<typeof HomeHeader>> = {}) {
  let r!: ReactTestRenderer;
  act(() => {
    r = create(
      <HomeHeader
        cursor={{ granularity: 'month', offset: 0 }}
        onChange={jest.fn()}
        userName="hemu"
        alertCount={2}
        scrollY={{ value: 0 } as never}
        onHeight={jest.fn()}
        line="Spending is steady."
        {...over}
      />
    );
  });
  return r;
}
const texts = (r: ReactTestRenderer) =>
  r.root.findAllByType(Text).map((t) =>
    [t.props.children]
      .flat(Infinity)
      .filter((c) => typeof c === 'string')
      .join('')
  );

describe('Home header', () => {
  it('scrolls Home to the top when the Yume logo is tapped', () => {
    const onBrandPress = jest.fn();
    const r = render({ onBrandPress });
    const logo = r.root.find((n) => n.props.accessibilityLabel === 'Yume, scroll to top' && n.props.onPress);
    expect(logo.props.accessibilityRole).toBe('button');
    act(() => logo.props.onPress());
    expect(onBrandPress).toHaveBeenCalledTimes(1);
  });

  it('is only a picture and a name when nothing is given to do', () => {
    const r = render();
    expect(r.root.findAll((n) => n.props.accessibilityLabel === 'Yume, scroll to top')).toHaveLength(0);
    expect(texts(r)).toContain('Yume');
  });

  it('greets by name with the date and Suu line, left-aligned', () => {
    const r = render();
    const all = texts(r).join(' ');
    expect(all).toContain('hemu');
    expect(all).toContain('Spending is steady.');
    for (const t of r.root.findAllByType(Text)) {
      expect(StyleSheet.flatten(t.props.style)?.textAlign).not.toBe('center');
    }
  });
});
