import { useEffect } from 'react';
import { Platform } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import { NavigationBar } from 'expo-navigation-bar';
import { theme } from '@/constants/theme';
import { getScheme } from './scheme';
import { useSchemeVersion } from './SchemeBoundary';

/**
 * The phone's own bars follow the app's colour mode (which can differ from the phone's: someone who picks Light on a
 * dark phone): dark icons on the light paper, light icons on the dark one, for the status bar and the navigation bar,
 * and the window behind the app (seen at an overscroll or while the keyboard moves) takes the page colour.
 */
export function AppStatusBar() {
  useSchemeVersion();
  const dark = getScheme() === 'dark';
  const page = theme.colors.background;
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    try {
      // `dark` means dark icons (for a light bar) here, as in the plugin's `style` option.
      NavigationBar.setStyle(dark ? 'light' : 'dark');
    } catch (e) {
      console.warn('Setting the navigation bar style failed:', e);
    }
    SystemUI.setBackgroundColorAsync(page).catch((e) =>
      console.warn('Setting the window background failed:', e)
    );
  }, [dark, page]);
  return <StatusBar style={dark ? 'light' : 'dark'} />;
}
