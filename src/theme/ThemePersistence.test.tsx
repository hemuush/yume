import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Pressable, View } from 'react-native';
import { Text } from '@/components/Text';
import { AccentProvider, useAccent } from './AccentContext';
import { getAccentColor, getThemeId, setAccentColor, setThemeSelection } from '@/db/settings';
import { ThemeSaveFeedback } from './ThemeSaveFeedback';
import { showAlert } from '@/components/AppDialog';
import { emitSettingsRestored } from '@/lib/dataEvents';

const mockRefreshed = jest.fn();

jest.mock('@/db/settings', () => ({
  getThemeId: jest.fn(async () => 'yume'),
  getAccentColor: jest.fn(async () => '#8FCBFF'),
  getCachedAccentColor: () => '#8FCBFF',
  setAccentColor: jest.fn(async () => undefined),
  setThemeSelection: jest.fn(async () => undefined),
}));

function Probe() {
  const value = useAccent();
  return (
    <View>
      <Text accessibilityLabel="Theme id">{value.themeId}</Text>
      <Text accessibilityLabel="Accent color">{value.accent}</Text>
      {value.themeSaveError && <Text accessibilityRole="alert">{value.themeSaveError.message}</Text>}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Choose violet"
        onPress={() => value.setTheme('hollowViolet')}
      />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Choose green"
        onPress={() => value.setTheme('corpsGreen')}
      />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Refresh widgets"
        onPress={() => void value.waitForThemePersistence().then(mockRefreshed)}
      />
    </View>
  );
}

function deferred(): { promise: Promise<void>; resolve: () => void } {
  let resolve: () => void = () => {
    throw new Error('Deferred promise not initialized');
  };
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

beforeEach(() => {
  jest.mocked(getThemeId).mockResolvedValue('yume');
  jest.mocked(getAccentColor).mockResolvedValue('#8FCBFF');
  jest.mocked(setAccentColor).mockReset().mockResolvedValue(undefined);
  jest.mocked(setThemeSelection).mockReset().mockResolvedValue(undefined);
});
afterEach(() => jest.restoreAllMocks());

async function mount(): Promise<void> {
  await render(
    <AccentProvider>
      <ThemeSaveFeedback />
      <Probe />
    </AccentProvider>
  );
}

it('restores the saved theme and reports a failed choice instead of pretending it was saved', async () => {
  const failure = new Error('Disk full');
  jest.mocked(setAccentColor).mockRejectedValueOnce(failure);
  jest.mocked(setThemeSelection).mockRejectedValueOnce(failure);
  const report = jest.spyOn(console, 'error').mockImplementation(() => undefined);
  await mount();
  await fireEvent.press(screen.getByRole('button', { name: 'Choose violet' }));
  await waitFor(() => expect(screen.getByLabelText('Theme id')).toHaveTextContent('yume'));
  expect(screen.getByLabelText('Accent color')).toHaveTextContent('#8FCBFF');
  expect(screen.getByRole('alert')).toHaveTextContent(/Choose it again to retry/);
  expect(report).toHaveBeenCalledWith('Theme preference could not be saved:', failure);
  expect(showAlert).toHaveBeenCalledWith(
    'Theme not saved',
    'Couldn’t save this theme. Choose it again to retry.'
  );
  await fireEvent.press(screen.getByRole('button', { name: 'Choose violet' }));
  await waitFor(() => expect(screen.getByLabelText('Theme id')).toHaveTextContent('hollowViolet'));
  expect(screen.queryByRole('alert')).toBeNull();
});

it('keeps the newest choice visible while earlier persistence finishes', async () => {
  const earlier = deferred();
  jest.mocked(setThemeSelection).mockReturnValueOnce(earlier.promise);
  await mount();
  await fireEvent.press(screen.getByRole('button', { name: 'Choose violet' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Choose green' }));
  expect(screen.getByLabelText('Theme id')).toHaveTextContent('corpsGreen');
  await act(() => earlier.resolve());
  await waitFor(() => expect(setThemeSelection).toHaveBeenLastCalledWith('corpsGreen', '#AEDABB'));
  expect(screen.getByLabelText('Theme id')).toHaveTextContent('corpsGreen');
});

it('falls back to the last successful choice when a newer queued choice fails', async () => {
  const earlier = deferred();
  const failure = new Error('Disk full');
  jest.mocked(setThemeSelection).mockReturnValueOnce(earlier.promise).mockRejectedValueOnce(failure);
  const report = jest.spyOn(console, 'error').mockImplementation(() => undefined);
  await mount();
  await fireEvent.press(screen.getByRole('button', { name: 'Choose violet' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Choose green' }));
  await act(() => earlier.resolve());
  await waitFor(() => expect(screen.getByLabelText('Theme id')).toHaveTextContent('hollowViolet'));
  expect(screen.getByRole('alert')).toBeOnTheScreen();
  expect(report).toHaveBeenCalledWith('Theme preference could not be saved:', failure);
});

it('shows another notice if retrying the same choice fails again', async () => {
  const failure = new Error('Disk full');
  jest.mocked(setThemeSelection).mockRejectedValue(failure);
  const report = jest.spyOn(console, 'error').mockImplementation(() => undefined);
  await mount();
  await fireEvent.press(screen.getByRole('button', { name: 'Choose violet' }));
  await waitFor(() => expect(showAlert).toHaveBeenCalledTimes(1));
  await fireEvent.press(screen.getByRole('button', { name: 'Choose violet' }));
  await waitFor(() => expect(showAlert).toHaveBeenCalledTimes(2));
  expect(report).toHaveBeenCalledTimes(2);
});

it('waits for the newest queued theme before allowing a background widget refresh', async () => {
  const earlier = deferred();
  jest.mocked(setThemeSelection).mockReturnValueOnce(earlier.promise);
  await mount();
  await fireEvent.press(screen.getByRole('button', { name: 'Choose violet' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Choose green' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Refresh widgets' }));
  expect(mockRefreshed).not.toHaveBeenCalled();
  await act(() => earlier.resolve());
  await waitFor(() => expect(mockRefreshed).toHaveBeenCalledTimes(1));
  expect(setThemeSelection).toHaveBeenLastCalledWith('corpsGreen', '#AEDABB');
});

it('preserves a restored theme when older writes finish and queued choices become obsolete', async () => {
  const earlier = deferred();
  const failure = new Error('Disk full');
  jest.mocked(setThemeSelection).mockReturnValueOnce(earlier.promise).mockRejectedValueOnce(failure);
  const report = jest.spyOn(console, 'error').mockImplementation(() => undefined);
  await mount();
  await fireEvent.press(screen.getByRole('button', { name: 'Choose violet' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Choose green' }));
  jest.mocked(getThemeId).mockResolvedValue('winterEmber');
  jest.mocked(getAccentColor).mockResolvedValue('#BEC8D4');
  await act(() => emitSettingsRestored());
  await waitFor(() => expect(screen.getByLabelText('Theme id')).toHaveTextContent('winterEmber'));
  await act(() => earlier.resolve());
  expect(setThemeSelection).toHaveBeenCalledTimes(1);
  await fireEvent.press(screen.getByRole('button', { name: 'Choose violet' }));
  await waitFor(() => expect(screen.getByRole('alert')).toBeOnTheScreen());
  expect(screen.getByLabelText('Theme id')).toHaveTextContent('winterEmber');
  expect(report).toHaveBeenCalledWith('Theme preference could not be saved:', failure);
});
