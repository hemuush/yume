import { StyleSheet } from 'react-native';
import { theme } from '@/constants/theme';
import { EYEBROW, FIELD_LABEL } from '@/constants/textStyles';

export const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  // Same load-error banner shape as Notifications, Transactions, Loans and Recurring, kept consistent.
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
  // In the sky header, under the title.
  intro: {
    fontFamily: theme.font.body,
    fontSize: 12,
    color: theme.colors.textSecondary,
    lineHeight: 17,
  },

  // White StripCards: sky for the change you're trying, mint for where it gets a goal.
  card: {
    marginHorizontal: 20,
    marginTop: 6,
    padding: 16,
    paddingTop: 18,
  },
  fieldLabel: {
    ...FIELD_LABEL,
    marginBottom: 6,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },

  avgRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
    marginTop: 14,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.surfaceAlt,
  },
  avgLabel: { fontFamily: theme.font.body, fontSize: 12, color: theme.colors.textSecondary },
  avgValue: { fontFamily: theme.font.monoBold, fontSize: 14, color: theme.colors.textPrimary },

  resultDivider: {
    height: 1,
    backgroundColor: theme.colors.divider,
    marginTop: 14,
    marginBottom: 12,
  },
  resultRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 6 },
  resultLabel: { fontFamily: theme.font.body, fontSize: 12, color: theme.colors.textSecondary },
  resultValue: { fontFamily: theme.font.monoBold, fontSize: 15, color: theme.colors.textPrimary },

  goalCard: {
    marginHorizontal: 20,
    marginTop: 16,
    padding: 16,
    paddingTop: 18,
  },
  extraLabel: { ...EYEBROW, color: theme.colors.incomeText },

  paceRow: { marginTop: 14, gap: 5 },
  paceHeadRow: { flexDirection: 'row', justifyContent: 'space-between' },
  paceLabel: { fontFamily: theme.font.body, fontSize: 10.5, color: theme.colors.textSecondary },
  paceLabelStrong: { fontFamily: theme.font.bodyBold, fontSize: 10.5, color: theme.colors.textPrimary },
  paceDate: { fontFamily: theme.font.monoBold, fontSize: 10.5, color: theme.colors.textSecondary },
  paceDateStrong: { fontFamily: theme.font.monoBold, fontSize: 10.5, color: theme.colors.textPrimary },
  paceTrack: { height: 6, borderRadius: 3, backgroundColor: theme.colors.divider, overflow: 'hidden' },
  paceFill: { height: '100%', borderRadius: 3 },

  soonerText: {
    marginTop: 12,
    paddingVertical: 8,
    borderRadius: theme.radius.md,
    overflow: 'hidden',
    backgroundColor: theme.colors.secondaryTint,
    textAlign: 'center',
    fontFamily: theme.font.bodyBold,
    fontSize: 12.5,
    color: theme.colors.incomeText,
  },
  neutralText: {
    marginTop: 12,
    textAlign: 'center',
    fontFamily: theme.font.body,
    fontSize: 11.5,
    color: theme.colors.textMuted,
  },

  footer: { marginHorizontal: 20, marginTop: 18 },
});
