import { Image } from 'react-native';
import { theme } from '@/constants/theme';

interface Props {
  size?: number;
  /** 'color' = the mark as-is; 'mono' = a single-colour silhouette via `tintColor`. */
  tone?: 'color' | 'mono';
  color?: string;
}

/**
 * The Yume mark — the same ring-and-dot asset as the app icon and Suu
 * (assets/yume-mark.png, cropped tight rather than padded for a home-screen
 * icon). Used in the Home header, Settings → About, and the lock screen.
 *
 * Previously its own hand-drawn ink-crescent-and-sprout SVG, left behind
 * when the app icon moved to this mark in the ring-mark rebrand — fixed in
 * a later pass so every rendering of "the logo" is the same shape again.
 * `tone="mono"` reuses the same image with React Native's `tintColor`
 * style rather than a second asset or separate paths.
 */
export function YumeLogo({ size = 28, tone = 'color', color }: Props) {
  const mono = tone === 'mono';
  return (
    <Image
      source={require('../../assets/yume-mark.png')}
      style={{ width: size, height: size, tintColor: mono ? (color ?? theme.colors.ink) : undefined }}
      resizeMode="contain"
    />
  );
}
