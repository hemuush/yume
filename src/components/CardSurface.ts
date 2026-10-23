import { StyleSheet } from 'react-native';
import { theme } from '@/constants/theme';

/** Flat supporting cards and one clear summary across financial screens. */
export const cardSurface = StyleSheet.create({
  neutral: { backgroundColor: theme.colors.surface, borderColor: theme.colors.borderSoft, boxShadow: 'none' },
  summary: {
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.borderSoft,
    boxShadow: 'none',
  },
});
