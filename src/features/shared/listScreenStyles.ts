import { StyleSheet } from 'react-native';
import { theme } from '@/constants/theme';

/** Styles Budgets and Categories (screens, rows, and their add/edit sheets) have in common. */
export const listScreenStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  errorBanner: {
    marginHorizontal: 20,
    marginTop: theme.layout.screenTopGap,
    marginBottom: 4,
    padding: 14,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.expenseTint,
    borderWidth: theme.border.thin,
    borderColor: theme.colors.expense,
  },
  errorTitle: { fontFamily: theme.font.bodyBold, fontSize: 13, color: theme.colors.expenseText },
  errorDetail: {
    fontFamily: theme.font.body,
    fontSize: 11.5,
    color: theme.colors.textSecondary,
    marginTop: 3,
    lineHeight: 16,
  },
  errorText: { fontFamily: theme.font.body, color: theme.colors.expenseText, fontSize: 13, marginBottom: 12 },
  fieldLabel: {
    fontSize: 10.5,
    fontFamily: theme.font.roundedMedium,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    color: theme.colors.textMuted,
    marginBottom: 6,
  },
  modalHint: {
    fontFamily: theme.font.body,
    fontSize: 12,
    color: theme.colors.textMuted,
    marginBottom: 14,
    lineHeight: 17,
  },
});
