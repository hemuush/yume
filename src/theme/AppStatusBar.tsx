import { StatusBar } from 'expo-status-bar';
import { getScheme } from './scheme';
import { useSchemeVersion } from './SchemeBoundary';

/** The phone's status bar: dark icons on the light paper, light icons on the dark one. */
export function AppStatusBar() {
  useSchemeVersion();
  return <StatusBar style={getScheme() === 'dark' ? 'light' : 'dark'} />;
}
