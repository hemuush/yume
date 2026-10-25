import { StyleSheet } from 'react-native';
import { theme } from '@/constants/theme';
import { EYEBROW } from '@/constants/textStyles';
import { SCREEN } from '@/components/screenStyles';

// Shared by Profile (shell, YouSection, SettingsSection) and the account modals. Cards, rows and headings
// come from Home's visual system (screenStyles, Section); these are only what Profile adds.
export const styles = StyleSheet.create({
  // Two fields side by side, wrapping to separate rows on a narrow screen or at large text.
  pairRow: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 10 },
  pairCell: { flexGrow: 1, flexBasis: 150, minWidth: 0 },

  container: { flex: 1, backgroundColor: theme.colors.background },
  errorBanner: {
    marginHorizontal: SCREEN.gutter,
    marginTop: theme.layout.screenTopGap,
    marginBottom: 12,
    padding: 14,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.expenseTint,
    borderWidth: theme.border.thin,
    borderColor: theme.colors.expense,
  },
  errorTitle: { fontFamily: theme.font.bodyBold, fontSize: 13, color: theme.colors.expenseText },
  errorDetail: {
    fontFamily: theme.font.body,
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginTop: 3,
    lineHeight: 16,
  },

  // ---- identity: avatar beside name and member since ----
  skeletonCard: { marginHorizontal: SCREEN.gutter, marginTop: 6, paddingTop: 14, paddingBottom: 10 },
  identity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: SCREEN.gutter,
    paddingTop: 8,
    paddingBottom: 4,
  },
  identityRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  identityText: { flex: 1, minWidth: 0 },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    // Without this, a circular View's background can render clipped to a stale layout measurement on Android
    // (the "half-circle avatar" symptom).
    overflow: 'hidden',
  },
  avatarInitial: { fontFamily: theme.font.roundedBold, fontSize: 25 },
  nameRow: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'flex-start',
    maxWidth: '100%',
  },
  name: {
    fontFamily: theme.font.roundedBold,
    fontSize: 22,
    color: theme.colors.textPrimary,
    flexShrink: 1,
  },
  nameInput: {
    minHeight: 48,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.colors.borderSoft,
    backgroundColor: theme.colors.surface,
    fontFamily: theme.font.bodyMedium,
    fontSize: 14,
    color: theme.colors.textPrimary,
  },
  // SegmentedControl draws its own pill; this only places it.
  tabWrap: { marginHorizontal: SCREEN.gutter, marginTop: 14, marginBottom: 4 },

  // ---- You: accounts, grouped by type ----
  groupHead: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 6,
  },
  groupLabel: { ...EYEBROW, fontSize: 12 },
  accountGroups: { gap: 10 },
  accountRow: { minHeight: 76, paddingVertical: 14 },
  accountContent: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 10 },
  accountContentStack: { flexDirection: 'column', alignItems: 'stretch', gap: 8 },
  accountNameStack: { flex: 0 },
  accountValues: { flexShrink: 1, maxWidth: '52%', alignItems: 'flex-end', gap: 4 },
  accountValuesStack: { maxWidth: '100%', alignItems: 'flex-start' },
  groupTotal: {
    fontVariant: ['tabular-nums'],
    fontFamily: theme.font.bodyBold,
    fontSize: 12,
    color: theme.colors.textSecondary,
  },
  archivedCard: { marginTop: 10 },
  archivedIcon: {
    backgroundColor: theme.colors.surfaceAlt,
    borderWidth: 1,
    borderColor: theme.colors.borderSoft,
  },
  archivedDim: { opacity: 0.6 },
  planLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginHorizontal: SCREEN.gutter,
    marginTop: 14,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.borderSoft,
    borderRadius: 20,
    boxShadow: 'none',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  planLinkIcon: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  planLinkText: { flex: 1, fontFamily: theme.font.roundedMedium, fontSize: 13, color: theme.colors.ink },

  // ---- Settings: rows ----
  settingsCard: { borderWidth: 1, paddingVertical: 4 },
  themeError: { color: theme.colors.expenseText, padding: theme.space.md },
  appearanceCard: { borderWidth: 1, padding: 14, gap: 10 },
  appearanceHead: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56 },
  appearanceTitle: { fontFamily: theme.font.roundedBold, fontSize: 18, color: theme.colors.textPrimary },
  appearanceHint: {
    fontFamily: theme.font.body,
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginTop: 3,
  },
  themeNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  themeName: { fontFamily: theme.font.bodyMedium, fontSize: 12, color: theme.colors.textPrimary },
  // Opens in place under the row that opened it, inside the same card.
  accordionBody: {
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 12,
    backgroundColor: theme.colors.surfaceAlt,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.borderSoft,
  },
  pickerHint: {
    fontFamily: theme.font.body,
    fontSize: 12,
    color: theme.colors.textMuted,
    lineHeight: 18,
    marginBottom: 6,
  },
  pickerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11 },
  codeBubble: {
    width: 44,
    minHeight: 30,
    borderRadius: 9,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.borderSoft,
    backgroundColor: theme.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  codeText: { fontFamily: theme.font.bodyBold, fontSize: 11, color: theme.colors.ink },
  // Compact Save/Clear pair inside the daily-spending-goal accordion; smaller than the modal-footer
  // PrimaryButton because it sits inline in a settings row.
  dailyGoalBtnRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 2 },
  dailyGoalBtn: { flexGrow: 1, flexBasis: 120 },

  // ---- Settings: inline theme swatches ----
  swatches: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  swatchHit: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  swatchActive: { borderWidth: 1.5, borderColor: theme.colors.ink },
  swatch: { width: 30, height: 30, borderRadius: 15, overflow: 'hidden', justifyContent: 'flex-end' },
  swatchHalf: { height: '50%' },
  swatchCheck: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },

  // ---- Settings: About footer ----
  footer: { alignItems: 'center', gap: 2, paddingTop: 26, paddingBottom: 4 },
  footerName: {
    fontFamily: theme.font.roundedBold,
    fontSize: 13,
    color: theme.colors.textPrimary,
    marginTop: 6,
  },
  footerSub: { fontFamily: theme.font.body, fontSize: 12, color: theme.colors.textMuted },
  footerLink: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 2, paddingVertical: 4 },
  footerLinkText: { fontFamily: theme.font.bodyBold, fontSize: 12, color: theme.colors.textSecondary },
  aboutCard: { padding: 14, gap: 12, marginTop: 8 },
  aboutTagline: { fontFamily: theme.font.bodyMedium, fontSize: 13, color: theme.colors.textPrimary },
  aboutFacts: { gap: 8 },
  aboutFactRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  aboutFactText: {
    flex: 1,
    fontFamily: theme.font.body,
    fontSize: 12,
    color: theme.colors.textSecondary,
    lineHeight: 17,
  },

  // ---- account modals ----
  fieldLabel: {
    fontSize: 12,
    fontFamily: theme.font.roundedMedium,
    color: theme.colors.textMuted,
    marginBottom: 6,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  toggleRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  hintText: {
    fontFamily: theme.font.body,
    fontSize: 12,
    color: theme.colors.textMuted,
    marginBottom: 14,
    lineHeight: 17,
  },
  errorText: { fontFamily: theme.font.body, color: theme.colors.expenseText, fontSize: 13, marginBottom: 12 },
});
