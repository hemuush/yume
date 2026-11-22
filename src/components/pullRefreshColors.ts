import { theme } from '@/constants/theme';

/**
 * The pull-to-refresh spinner's colours, the same on every screen: the app's ink on its own surface. Home and Activity
 * used each user's accent colour and Plan the link blue, so the spinner changed colour from tab to tab. Read at render,
 * so it follows the colour mode.
 */
export const pullRefreshColors = () => ({
  tintColor: theme.colors.ink,
  colors: [theme.colors.ink],
  progressBackgroundColor: theme.colors.surface,
});
