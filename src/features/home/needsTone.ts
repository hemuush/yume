import type Feather from '@expo/vector-icons/Feather';
import { theme } from '@/constants/theme';
import type { NeedsYouTone } from './needsYou';

/** Each urgency's colour (the row's rail and icon) and its fallback icon. Also the bell hero's chips. */
export const NEEDS_TONE: Record<
  NeedsYouTone,
  { color: string; label: string; icon: React.ComponentProps<typeof Feather>['name'] }
> = {
  urgent: { color: theme.colors.expense, label: 'urgent', icon: 'alert-circle' },
  warn: { color: theme.colors.warnInk, label: 'soon', icon: 'pie-chart' },
  info: { color: theme.colors.link, label: 'when you can', icon: 'folder' },
};
