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

  // Glass cards on the wallpaper: the change you're trying, then where it gets a goal.
  card: {
    marginHorizontal: 20,
    marginTop: theme.layout.screenTopGap,
    padding: 16,
  },
  fieldLabel: {
    ...FIELD_LABEL,
    marginBottom: 6,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },

  // Now → with the cut, a month: two figures in a frosted panel.
  compare: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 16,
    padding: 12,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.8)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.92)',
  },
  compareSide: { flex: 1, minWidth: 0, gap: 2 },
  compareRight: { alignItems: 'flex-end' },
  compareLabel: { fontFamily: theme.font.bodyMedium, fontSize: 11.5, color: theme.colors.textMuted },
  compareValue: {
    fontFamily: theme.font.body,
    fontSize: 20,
    letterSpacing: -0.4,
    color: theme.colors.textPrimary,
  },
  compareNew: { color: theme.colors.incomeText },
  avgLabel: { fontFamily: theme.font.body, fontSize: 12, color: theme.colors.textSecondary },

  goalCard: {
    marginHorizontal: 20,
    marginTop: 12,
    padding: 16,
  },
  extraLabel: { ...EYEBROW, color: theme.colors.incomeText },

  paceRow: { marginTop: 14, gap: 7 },
  paceHeadRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  paceLabel: { fontFamily: theme.font.body, fontSize: 12.5, color: theme.colors.textSecondary },
  paceLabelStrong: { fontFamily: theme.font.bodyBold, fontSize: 12.5, color: theme.colors.textPrimary },
  paceDate: { fontFamily: theme.font.bodyMedium, fontSize: 12.5, color: theme.colors.textSecondary },
  paceDateStrong: { fontFamily: theme.font.bodyBold, fontSize: 12.5, color: theme.colors.textPrimary },
  // A frosted line with a dot where the date lands; the dot sits on the line's end, so no clipping.
  paceTrack: {
    height: 10,
    borderRadius: 5,
    backgroundColor: 'rgba(255,255,255,0.7)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.92)',
    justifyContent: 'center',
  },
  paceFill: { position: 'absolute', left: 0, top: 0, bottom: 0, borderRadius: 5 },
  paceDot: {
    position: 'absolute',
    top: -4,
    width: 16,
    height: 16,
    marginLeft: -8,
    borderRadius: 8,
    borderWidth: 3,
    backgroundColor: theme.colors.surface,
  },

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
