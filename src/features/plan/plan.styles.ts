import { StyleSheet } from 'react-native';
import { theme } from '@/constants/theme';
import { SCREEN } from '@/components/screenStyles';
import { themedValue } from '@/theme/themedStyles';

export const planWorkspaceCard = themedValue(() => ({
  marginHorizontal: 16,
  borderWidth: StyleSheet.hairlineWidth,
  borderColor: theme.colors.home.edge,
  borderRadius: theme.radius.xl,
  backgroundColor: theme.colors.home.surface,
}));

// Each Money plan collection shares the same restrained list surface.
export const planMoneyList = themedValue(() => ({
  marginHorizontal: SCREEN.gutter,
  borderWidth: StyleSheet.hairlineWidth,
  borderColor: theme.colors.home.edge,
  borderRadius: theme.radius.xl,
  overflow: 'hidden' as const,
  backgroundColor: theme.colors.home.surface,
}));
