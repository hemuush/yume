import { useMemo } from 'react';
import { contrastRatio } from '@/lib/color';
import { theme } from '@/constants/theme';
import { useSchemeVersion } from './SchemeBoundary';

interface AccentValue {
  /** The sky of the logo: the lead colour of buttons, tabs and marks. Follows the colour mode. */
  accent: string;
  /** The mint beside it. */
  secondary: string;
  /** Suu's dot: the coral of the logo. */
  dot: string;
  /** The text colour that reads on `accent`. */
  onAccent: string;
}

function contrastColor(hex: string): string {
  return contrastRatio(hex, theme.colors.ink) >= contrastRatio(hex, theme.colors.surface)
    ? theme.colors.ink
    : theme.colors.surface;
}

/**
 * The app's one accent, as a hook so every screen asks the same way it did when the accent was a choice. There is
 * a single theme now (the sky and coral of the logo), so there is nothing to pick, save or restore; the values are
 * read from the colour table and are worked out again when the colour mode changes.
 */
export function useAccent(): AccentValue {
  const version = useSchemeVersion();
  return useMemo(
    () => ({
      accent: theme.colors.primary,
      secondary: theme.colors.secondary,
      dot: theme.colors.coral,
      onAccent: contrastColor(theme.colors.primary),
    }),
    // The colours come from the table of the mode in use, which `version` stands for.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [version]
  );
}
