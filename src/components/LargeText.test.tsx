import { act, fireEvent, render, screen } from '@testing-library/react-native';
import type { ComponentProps } from 'react';
import * as Native from 'react-native';
import { Text, TextInput } from './Text';
import { PadButton } from './AmountPad';
import { PillTabBar } from './PillTabBar';

jest.mock('@expo/vector-icons/Feather', () => () => null);
jest.mock('react-native-reanimated', () => require('@/test-support/reanimatedMock').createReanimatedMock());
jest.mock('./icons/TabIcons', () => ({
  HomeIcon: () => null,
  ActivityIcon: () => null,
  PlanIcon: () => null,
  ReportsIcon: () => null,
}));
jest.mock('@/theme/AccentContext', () => ({ useAccent: () => ({ accent: '#8FCBFF' }) }));
jest.mock('@/lib/usePressScale', () => ({
  usePressScale: () => ({ animatedStyle: {}, onPressIn: jest.fn(), onPressOut: jest.fn() }),
}));

beforeEach(() => {
  jest.spyOn(Native.Dimensions, 'get').mockReturnValue({ width: 360, height: 800, scale: 1, fontScale: 2 });
  jest.spyOn(Native, 'useWindowDimensions').mockReturnValue({
    width: 360,
    height: 800,
    scale: 1,
    fontScale: 2,
  });
});

afterEach(() => jest.restoreAllMocks());

it('allows labels and editable fields to follow the 200% font setting', async () => {
  await render(
    <>
      <Text>Account balance</Text>
      <TextInput accessibilityLabel="Account name" />
    </>
  );
  expect(screen.getByText('Account balance')).toHaveProp('maxFontSizeMultiplier', 2);
  expect(screen.getByLabelText('Account name')).toHaveProp('maxFontSizeMultiplier', 2);
});

it('gives a large-font number-pad label room to grow instead of a fixed-height key', async () => {
  await render(<PadButton padKey="7" onPress={jest.fn()} />);
  const key = screen.getByRole('button', { name: '7' });
  const style = Native.StyleSheet.flatten(key.props.style);
  expect(style.height).toBeUndefined();
  expect(style.minHeight).toBeGreaterThanOrEqual(60);
});

it('lets a long amount wrap at large font size instead of shrinking it to one line', async () => {
  await render(
    <Text numberOfLines={1} adjustsFontSizeToFit>
      12,34,56,789
    </Text>
  );
  const amount = screen.getByText('12,34,56,789');
  expect(amount.props.numberOfLines).toBeUndefined();
  expect(amount.props.adjustsFontSizeToFit).toBe(false);
});

it('grows a fixed-height input so its enlarged text has room', async () => {
  await render(<TextInput accessibilityLabel="Entry note" style={{ height: 40, fontSize: 16 }} />);
  const input = screen.getByLabelText('Entry note');
  expect(Native.StyleSheet.flatten(input.props.style).minHeight).toBeGreaterThan(40);
});

it('includes input padding and borders when making room for large text', async () => {
  await render(
    <TextInput
      accessibilityLabel="Account description"
      style={{ height: 40, fontSize: 16, lineHeight: 24, padding: 12, borderWidth: 1 }}
    />
  );
  const input = screen.getByLabelText('Account description');
  expect(Native.StyleSheet.flatten(input.props.style).minHeight).toBeGreaterThanOrEqual(74);
});

it('shows the active tab label at 200% and keeps every tab available', async () => {
  const navigate = jest.fn();
  const routes = ['index', 'transactions', 'plan', 'reports'].map((name) => ({ key: name, name }));
  const descriptors = Object.fromEntries(
    routes.map((route) => [
      route.key,
      {
        options: {
          title: { index: 'Home', transactions: 'Activity', plan: 'Plan', reports: 'Reports' }[route.name],
        },
      },
    ])
  );
  // Router owns the full navigation objects; this boundary fixture supplies only what the bar consumes.
  const props = {
    state: { index: 3, routes },
    descriptors,
    emitter: { emit: () => ({ defaultPrevented: false }) },
    navigateToTab: navigate,
    insets: { top: 0, bottom: 0, left: 0, right: 0 },
    onAdd: jest.fn(),
    onAddLongPress: jest.fn(),
  } as unknown as ComponentProps<typeof PillTabBar>;
  await render(<PillTabBar {...props} />);
  expect(screen.getByText('Reports')).toHaveProp('maxFontSizeMultiplier', 2);
  await fireEvent.press(screen.getByRole('tab', { name: 'Activity' }));
  expect(navigate).toHaveBeenCalledWith('transactions');
  expect(screen.getAllByRole('tab')).toHaveLength(4);
});

it('updates wrapping when the OS text setting changes and releases its shared listener', async () => {
  const size = { width: 360, height: 800, scale: 1, fontScale: 1 };
  jest.mocked(Native.Dimensions.get).mockReturnValue(size);
  type ChangeHandler = Parameters<typeof Native.Dimensions.addEventListener>[1];
  let onChange: ChangeHandler | null = null;
  const remove = jest.fn();
  const subscribe = jest
    .spyOn(Native.Dimensions, 'addEventListener')
    .mockImplementation((_event, callback) => {
      onChange = callback;
      return { remove };
    });
  const result = await render(
    <>
      <Text numberOfLines={1}>Account balance</Text>
      <Text>Available</Text>
    </>
  );
  expect(subscribe).toHaveBeenCalledTimes(1);
  expect(screen.getByText('Account balance')).toHaveProp('numberOfLines', 1);
  await act(() => {
    const enlarged = { ...size, fontScale: 2 };
    jest.mocked(Native.Dimensions.get).mockReturnValue(enlarged);
    if (!onChange) throw new Error('No dimension listener registered');
    onChange({ window: enlarged, screen: enlarged });
  });
  expect(screen.getByText('Account balance').props.numberOfLines).toBeUndefined();
  await result.unmount();
  expect(remove).toHaveBeenCalledTimes(1);
});
