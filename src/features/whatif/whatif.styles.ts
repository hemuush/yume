import { StyleSheet } from 'react-native';
import { theme } from '@/constants/theme';

export const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  // Same shape every other screen's load-error banner uses (Notifications,
  // Transactions, Loans, Recurring, ...) — kept visually consistent rather
  // than a one-off inline style.
  errorBanner: {
    marginHorizontal: 20,
    marginTop: 8,
    padding: 14,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.expenseTint,
    borderWidth: theme.border.thin,
    borderColor: theme.colors.expense,
  },
  errorTitle: { fontFamily: theme.font.bodyBold, fontSize: 13, color: theme.colors.expense },
  errorDetail: { fontFamily: theme.font.body, fontSize: 11.5, color: theme.colors.textSecondary, marginTop: 3, lineHeight: 16 },
  intro: {
    fontFamily: theme.font.body,
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginHorizontal: 20,
    marginTop: 4,
    lineHeight: 17,
  },

  card: {
    marginHorizontal: 20,
    marginTop: 16,
    backgroundColor: theme.colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.borderSoft,
    borderRadius: theme.radius.xl,
    padding: 16,
  },
  fieldLabel: {
    fontFamily: theme.font.bodyBold,
    fontSize: 10.5,
    color: theme.colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 8,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },

  avgRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6, marginTop: 14 },
  avgLabel: { fontFamily: theme.font.body, fontSize: 12, color: theme.colors.textSecondary },
  avgValue: { fontFamily: theme.font.monoBold, fontSize: 14, color: theme.colors.textPrimary },

  resultDivider: {
    height: 1,
    backgroundColor: theme.colors.borderSoft,
    marginTop: 14,
    marginBottom: 12,
  },
  resultRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  resultLabel: { fontFamily: theme.font.body, fontSize: 12, color: theme.colors.textSecondary },
  resultValue: { fontFamily: theme.font.monoBold, fontSize: 15, color: theme.colors.textPrimary },

  goalCard: {
    marginHorizontal: 20,
    marginTop: 14,
    backgroundColor: theme.colors.secondaryTint,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.secondary,
    borderRadius: theme.radius.xl,
    padding: 16,
  },
  extraLabel: {
    fontFamily: theme.font.bodyBold,
    fontSize: 10.5,
    color: theme.colors.income,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },

  paceRow: { marginTop: 14, gap: 5 },
  paceHeadRow: { flexDirection: 'row', justifyContent: 'space-between' },
  paceLabel: { fontFamily: theme.font.body, fontSize: 10.5, color: theme.colors.textSecondary },
  paceLabelStrong: { fontFamily: theme.font.bodyBold, fontSize: 10.5, color: theme.colors.textPrimary },
  paceDate: { fontFamily: theme.font.monoBold, fontSize: 10.5, color: theme.colors.textSecondary },
  paceDateStrong: { fontFamily: theme.font.monoBold, fontSize: 10.5, color: theme.colors.textPrimary },
  paceTrack: { height: 6, borderRadius: 3, backgroundColor: theme.colors.inkWash, overflow: 'hidden' },
  paceFill: { height: '100%', borderRadius: 3 },

  soonerText: {
    marginTop: 12,
    textAlign: 'center',
    fontFamily: theme.font.bodyBold,
    fontSize: 12.5,
    color: theme.colors.income,
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
