import { StyleSheet } from 'react-native';
import { theme } from '@/constants/theme';
import { EYEBROW } from '@/constants/textStyles';
import { SCREEN } from '@/components/screenStyles';
import { GLASS } from '@/components/Glass';

// Shared by Profile (shell, YouSection, SettingsSection) and the account modals. Cards, rows and headings
// come from Home's visual system (screenStyles, Section); these are only what Profile adds.
export const styles = StyleSheet.create({
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
    fontSize: 11.5,
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
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    // Without this, a circular View's background can render clipped to a stale layout measurement on Android
    // (the "half-circle avatar" symptom).
    overflow: 'hidden',
  },
  avatarInitial: { fontFamily: theme.font.roundedBold, fontSize: 20 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start', maxWidth: '100%' },
  name: {
    fontFamily: theme.font.roundedBold,
    fontSize: theme.typeSize.greeting,
    color: theme.colors.textPrimary,
    flexShrink: 1,
  },
  nameEditRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.borderSoft,
    borderRadius: theme.radius.lg,
    paddingHorizontal: 12,
  },
  nameInput: {
    flex: 1,
    paddingVertical: 8,
    fontFamily: theme.font.bodyMedium,
    fontSize: 15,
    color: theme.colors.textPrimary,
  },
  nameSave: { paddingLeft: 10 },
  memberSince: { fontFamily: theme.font.body, fontSize: 12.5, color: theme.colors.textMuted, marginTop: 2 },
  // SegmentedControl draws its own pill; this only places it.
  tabWrap: { marginHorizontal: SCREEN.gutter, marginTop: 16 },

  // ---- You: accounts, grouped by type ----
  groupHead: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 6,
  },
  groupLabel: { ...EYEBROW },
  groupTotal: { fontFamily: theme.font.monoBold, fontSize: 12, color: theme.colors.textSecondary },
  archivedCard: { marginTop: 10 },
  archivedIcon: { backgroundColor: GLASS.fillStrong, borderWidth: 1, borderColor: GLASS.edge },
  archivedDim: { opacity: 0.6 },
  planLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginHorizontal: SCREEN.gutter,
    marginTop: 14,
    backgroundColor: GLASS.fill,
    borderWidth: 1,
    borderColor: GLASS.edge,
    borderRadius: 20,
    boxShadow: GLASS.shadow,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  planLinkIcon: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  planLinkText: { flex: 1, fontFamily: theme.font.roundedMedium, fontSize: 13.5, color: theme.colors.ink },

  // ---- Settings: backup needs attention ----
  nudge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginHorizontal: SCREEN.gutter,
    marginTop: 12,
    paddingVertical: 11,
    paddingHorizontal: 14,
    backgroundColor: theme.colors.idCoral,
    borderRadius: theme.radius.xl2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.idCoralDeep,
  },
  nudgeIcon: {
    width: 34,
    height: 34,
    borderRadius: 11,
    backgroundColor: theme.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nudgeSub: { fontFamily: theme.font.body, fontSize: 12, color: theme.colors.textSecondary, marginTop: 2 },
  nudgePill: {
    backgroundColor: theme.colors.ink,
    borderRadius: theme.radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  nudgePillText: { fontFamily: theme.font.roundedBold, fontSize: 12, color: theme.colors.surface },

  // ---- Settings: rows ----
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
    fontSize: 12.5,
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
  dailyGoalBtnRow: { flexDirection: 'row', gap: 8, marginTop: 2 },
  dailyGoalBtn: { flex: 1 },

  // ---- Settings: About footer ----
  footer: { alignItems: 'center', gap: 2, paddingTop: 26, paddingBottom: 4 },
  footerName: {
    fontFamily: theme.font.roundedBold,
    fontSize: 14,
    color: theme.colors.textPrimary,
    marginTop: 6,
  },
  footerSub: { fontFamily: theme.font.body, fontSize: 12, color: theme.colors.textMuted },
  footerLink: { flexDirection: 'row', alignItems: 'center', gap: 2, paddingVertical: 4 },
  footerLinkText: { fontFamily: theme.font.bodyBold, fontSize: 12, color: theme.colors.textSecondary },
  aboutCard: { padding: 14, gap: 12, marginTop: 8 },
  aboutTagline: { fontFamily: theme.font.bodyMedium, fontSize: 13, color: theme.colors.textPrimary },
  aboutFacts: { gap: 8 },
  aboutFactRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  aboutFactText: {
    flex: 1,
    fontFamily: theme.font.body,
    fontSize: 12.5,
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
  toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  hintText: {
    fontFamily: theme.font.body,
    fontSize: 12,
    color: theme.colors.textMuted,
    marginBottom: 14,
    lineHeight: 17,
  },
  errorText: { fontFamily: theme.font.body, color: theme.colors.expenseText, fontSize: 13, marginBottom: 12 },
});
