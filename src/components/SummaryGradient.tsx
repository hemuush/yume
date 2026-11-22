import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet } from 'react-native';
import { getScheme } from '@/theme/scheme';
import { themedValue } from '@/theme/themedStyles';

// The summary card's text roles, each paired with its own surface: a light sky in the light mode, and a deep sky in the
// dark one (a light card on a graphite page would glare). `faint` and `chip` are for bars and pills drawn on it.
const LIGHT = {
  background: '#A6CBFC',
  text: '#0B1533',
  secondary: '#26355F',
  positive: '#08492B',
  negative: '#8A1B13',
  link: '#173F8F',
  divider: '#0B153326',
  faint: '#0B153366',
  chip: '#FFFFFFA6',
};
const DARK = {
  background: '#1B3558',
  text: '#F3F7FF',
  secondary: '#BCCDE8',
  positive: '#86E8BA',
  negative: '#FF9F96',
  link: '#A9CCFF',
  divider: '#FFFFFF2E',
  faint: '#F3F7FF66',
  chip: '#FFFFFF24',
};
/** Both modes' roles, for the contrast test. */
export const SUMMARY_INK = { light: LIGHT, dark: DARK } as const;
export const summaryInk = themedValue(() => (getScheme() === 'dark' ? DARK : LIGHT));

export const LIGHT_GRADIENT = ['#C4DCFD', '#A6CBFC', '#8EBBF8'] as const;
export const DARK_GRADIENT = ['#244A78', '#1B3558', '#142744'] as const;

export function SummaryGradient() {
  return (
    <LinearGradient
      pointerEvents="none"
      colors={getScheme() === 'dark' ? DARK_GRADIENT : LIGHT_GRADIENT}
      start={{ x: 0, y: 1 }}
      end={{ x: 1, y: 0 }}
      style={StyleSheet.absoluteFill}
    />
  );
}
