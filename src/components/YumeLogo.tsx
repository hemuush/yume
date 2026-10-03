import { Image } from 'react-native';
import { theme } from '@/constants/theme';

interface Props {
  size?: number;
  /** 'color' = the mark as-is; 'mono' = a single-colour silhouette via `tintColor`. */
  tone?: 'color' | 'mono';
  color?: string;
}

/**
 * The Yume mark: the ring-and-dot asset shared with the app icon and Suu (assets/yume-mark.png, cropped
 * tight). `tone="mono"` reuses the image via `tintColor` rather than a second asset.
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
