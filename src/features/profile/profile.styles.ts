import { StyleSheet } from 'react-native';
import { theme } from '@/constants/theme';
import { HOME } from '@/features/home/homeStyles';

// Shared by the Profile screen (its shell, YouSection, and SettingsSection)
// and the account modals (AddAccountModal, AccountDetailModal). Cards, rows
// and section headings come from Home's one visual system (homeStyles,
// HomeSection); these are only what Profile adds on top.
export const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  errorBanner: {
    marginHorizontal: HOME.gutter,
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
  identity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: HOME.gutter,
    paddingTop: 8,
    paddingBottom: 4,
  },
  identityText: { flex: 1, minWidth: 0 },
  avatar: {
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: 'center',
    justifyContent: 'center',
    // Without this, a circular View's coloured background can render
    // clipped to a stale layout measurement on Android (the classic
    // "half-circle avatar" symptom) rather than the declared size.
    overflow: 'hidden',
  },
  avatarInitial: { fontFamily: theme.font.roundedBold, fontSize: 24 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start', maxWidth: '100%' },
  name: { fontFamily: theme.font.roundedBold, fontSize: 21, color: theme.colors.textPrimary, flexShrink: 1 },
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
  tabWrap: { marginHorizontal: HOME.gutter, marginTop: 16 },

  // ---- You: tracked balance as a sum ----
  balanceCard: { marginTop: 12 },
  balanceHead: { paddingHorizontal: 16, paddingTop: 16 },
  balanceLabel: {
    fontFamily: theme.font.bodyBold,
    fontSize: 11,
    color: theme.colors.textMuted,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  // Profile's one hero number — the only big mono figure on this screen.
  balanceValue: {
    fontFamily: theme.font.monoBold,
    fontSize: 27,
    color: theme.colors.textPrimary,
    marginTop: 2,
  },
  sumLines: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12, gap: 6 },
  sumLine: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  sumKey: { width: 10, height: 10, borderRadius: 3 },
  sumLabel: { flex: 1, fontFamily: theme.font.body, fontSize: 13, color: theme.colors.textSecondary },
  sumValue: { fontFamily: theme.font.monoBold, fontSize: 13, color: theme.colors.textPrimary },
  balanceHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.borderSoft,
  },
  balanceHintWarn: { backgroundColor: theme.colors.idGold },
  balanceHintText: {
    flex: 1,
    fontFamily: theme.font.body,
    fontSize: 12,
    lineHeight: 16,
    color: theme.colors.textSecondary,
  },
  stats: {
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.borderSoft,
  },
  stat: { flex: 1, alignItems: 'center', paddingVertical: 11 },
  statDivider: { borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: theme.colors.borderSoft },
  statValue: { fontFamily: theme.font.roundedBold, fontSize: 18, color: theme.colors.textPrimary },
  statLabel: { fontFamily: theme.font.bodyMedium, fontSize: 11, color: theme.colors.textMuted },

  // ---- You: accounts ----
  cardFoot: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  cardFootLabel: { fontFamily: theme.font.body, fontSize: 12.5, color: theme.colors.textMuted },
  cardFootValue: { fontFamily: theme.font.monoBold, fontSize: 13.5, color: theme.colors.textPrimary },
  archivedCard: { marginTop: 10 },
  archivedDim: { opacity: 0.6 },
  planLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginHorizontal: HOME.gutter,
    marginTop: 14,
    backgroundColor: theme.colors.secondaryTint,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.secondary,
    borderRadius: theme.radius.xl2,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  planLinkIcon: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  planLinkText: { flex: 1, fontFamily: theme.font.roundedMedium, fontSize: 13.5, color: theme.colors.ink },

  // ---- Settings: at a glance ----
  glanceRow: { flexDirection: 'row', gap: 8, marginHorizontal: HOME.gutter, marginTop: 12 },
  glanceTile: {
    flex: 1,
    minWidth: 0,
    gap: 3,
    padding: 10,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.borderSoft,
  },
  glanceIcon: {
    width: 24,
    height: 24,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  glanceTitle: { fontFamily: theme.font.bodyBold, fontSize: 12.5, color: theme.colors.textPrimary },
  glanceSub: { fontFamily: theme.font.body, fontSize: 11, color: theme.colors.textMuted },

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
    height: 30,
    borderRadius: 9,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.borderSoft,
    backgroundColor: theme.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  codeText: { fontFamily: theme.font.bodyBold, fontSize: 11, color: theme.colors.ink },
  // Compact Save/Clear pair inside the daily-spending-goal accordion —
  // smaller than the full-width PrimaryButton used in modal footers, since
  // this sits inline inside a settings row, not its own screen.
  dailyGoalBtnRow: { flexDirection: 'row', gap: 8, marginTop: 2 },
  dailyGoalBtn: { flex: 1 },

  // ---- Settings: theme swatches ----
  // The current theme, drawn as a little piece of Home; tapping opens the Theme page.
  themeCard: { overflow: 'hidden' },
  themeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  themeName: { fontFamily: theme.font.roundedBold, fontSize: 15, color: theme.colors.textPrimary },
  themeChange: {
    backgroundColor: theme.colors.ink,
    borderRadius: theme.radius.pill,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  themeChangeText: { fontFamily: theme.font.roundedBold, fontSize: 12.5, color: theme.colors.surface },

  // ---- Settings: about ----
  aboutCard: { padding: 14, gap: 12 },
  aboutTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  aboutName: { fontFamily: theme.font.roundedBold, fontSize: 18, color: theme.colors.textPrimary },
  aboutTagline: { fontFamily: theme.font.body, fontSize: 12, color: theme.colors.textMuted, marginTop: 1 },
  aboutVersion: { fontFamily: theme.font.monoBold, fontSize: 11, color: theme.colors.textMuted },
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
    fontSize: 10.5,
    fontFamily: theme.font.roundedMedium,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    color: theme.colors.textMuted,
    marginBottom: 6,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  hintText: {
    fontFamily: theme.font.body,
    fontSize: 12,
    color: theme.colors.textMuted,
    marginBottom: 14,
    lineHeight: 17,
  },
  errorText: { fontFamily: theme.font.body, color: theme.colors.expenseText, fontSize: 13, marginBottom: 12 },
});
