import { StyleSheet } from 'react-native';
import { theme } from '@/constants/theme';

/** Existing palette, flat supporting cards and one clear summary across financial screens. */
export const cardSurface = StyleSheet.create({
  neutral: { backgroundColor: theme.colors.surface, borderColor: theme.colors.borderSoft, boxShadow: 'none' },
  summary: {
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.inkHairline,
    boxShadow: 'none',
  },
  savings: {
    backgroundColor: theme.colors.secondaryTint,
    borderColor: theme.colors.borderSoft,
    boxShadow: 'none',
  },
  payments: { backgroundColor: theme.colors.dueRow, borderColor: theme.colors.borderSoft, boxShadow: 'none' },
  debt: { backgroundColor: theme.colors.idCoral, borderColor: theme.colors.borderSoft, boxShadow: 'none' },
  warning: {
    backgroundColor: theme.colors.expenseTint,
    borderColor: theme.colors.borderSoft,
    boxShadow: 'none',
  },
});
