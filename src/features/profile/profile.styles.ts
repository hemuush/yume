import { StyleSheet } from 'react-native';
import { theme } from '@/constants/theme';

// Shared by the merged Profile screen (its shell, YouSection, and
// SettingsSection) and the account modals (AddAccountModal,
// AccountDetailModal). SettingsSection's own keys (group/row/swatch/about/
// picker*) were folded in from the old standalone settings.tsx — same
// values, nothing restyled.
export const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  errorBanner: {
    marginHorizontal: 20,
    marginBottom: 12,
    padding: 14,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.expenseTint,
    borderWidth: theme.border.thin,
    borderColor: theme.colors.expense,
  },
  errorTitle: { fontFamily: theme.font.bodyBold, fontSize: 13, color: theme.colors.expense },
  errorDetail: { fontSize: 11.5, color: theme.colors.textSecondary, marginTop: 3, lineHeight: 16 },
  identity: { alignItems: 'center', paddingHorizontal: 20, paddingBottom: 8 },
  avatar: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.borderSoft,
    alignItems: 'center',
    justifyContent: 'center',
    // Without this, a circular View's coloured background can render
    // clipped to a stale layout measurement on Android (the classic
    // "half-circle avatar" symptom) rather than the declared 76×76 size —
    // a real bug, not a styling choice.
    overflow: 'hidden',
  },
  avatarInitial: { fontFamily: theme.font.roundedBold, fontSize: 30 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 },
  name: { fontFamily: theme.font.roundedBold, fontSize: 20, color: theme.colors.textPrimary },
  nameEditRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'stretch',
    marginTop: 12,
    marginHorizontal: 20,
    backgroundColor: theme.colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.borderSoft,
    borderRadius: theme.radius.lg,
    paddingHorizontal: 12,
  },
  nameInput: {
    flex: 1,
    paddingVertical: 10,
    fontFamily: theme.font.bodyMedium,
    fontSize: 15,
    color: theme.colors.textPrimary,
  },
  nameSave: { paddingLeft: 10 },
  memberSince: { fontFamily: theme.font.body, fontSize: 12, color: theme.colors.textMuted, marginTop: 4 },

  netWorthCard: { marginHorizontal: 20, marginTop: 16, padding: 16 },
  netWorthLabel: {
    fontFamily: theme.font.bodyBold,
    fontSize: 10.5,
    color: theme.colors.textMuted,
    letterSpacing: 0.6,
  },
  // Profile's one hero number — the only place on this screen mono shows
  // up, matching the "rationed to one big figure per screen" rule.
  netWorthValue: {
    fontFamily: theme.font.monoBold,
    fontSize: 26,
    color: theme.colors.textPrimary,
    marginTop: 4,
  },
  netWorthHint: { fontFamily: theme.font.body, fontSize: 11.5, color: theme.colors.textMuted, marginTop: 4 },

  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingHorizontal: 20, marginTop: 12 },
  statCell: {
    flexGrow: 1,
    flexBasis: '45%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
  },
  statText: { flex: 1, minWidth: 0 },
  statValue: { fontFamily: theme.font.roundedBold, fontSize: 16, color: theme.colors.textPrimary },
  statLabel: {
    fontFamily: theme.font.bodyBold,
    fontSize: 9.5,
    color: theme.colors.textMuted,
    marginTop: 1,
    letterSpacing: 0.5,
  },

  gardenLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: 20,
    marginTop: 12,
    backgroundColor: theme.colors.secondaryTint,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.secondary,
    borderRadius: theme.radius.lg,
    padding: 13,
  },
  gardenLinkText: { flex: 1, fontFamily: theme.font.roundedMedium, fontSize: 13, color: theme.colors.ink },

  emptyCard: { marginHorizontal: 20, padding: 14, borderRadius: 16 },
  emptyCardRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  emptyCardIcon: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  emptyCardTitle: { fontFamily: theme.font.roundedMedium, fontSize: 13.5, color: theme.colors.textPrimary },
  emptyCardSubtitle: {
    fontFamily: theme.font.body,
    fontSize: 11,
    color: theme.colors.textMuted,
    marginTop: 1,
    lineHeight: 15,
  },
  emptyCardCta: {
    marginTop: 12,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderRadius: 11,
    paddingVertical: 9,
    alignItems: 'center',
  },
  emptyCardCtaText: { fontFamily: theme.font.bodyBold, fontSize: 12, color: theme.colors.textPrimary },

  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginHorizontal: 20,
    marginTop: 22,
    marginBottom: 4,
  },
  accountCardWrap: { marginHorizontal: 20, marginTop: 10 },
  accountCard: { padding: 16, borderRadius: 16 },
  accountCardInner: { flexDirection: 'row', alignItems: 'center' },
  accountName: { fontSize: 16, fontFamily: theme.font.bodyBold, color: theme.colors.textPrimary },
  accountType: {
    fontSize: 12,
    color: theme.colors.textMuted,
    marginTop: 2,
    textTransform: 'capitalize',
  },
  accountBalance: { fontSize: 16, fontFamily: theme.font.bodyBold, color: theme.colors.textPrimary },
  negative: { color: theme.colors.expense },
  archivedCard: { opacity: 0.6 },

  fieldLabel: {
    fontSize: 10.5,
    fontFamily: theme.font.roundedMedium,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    color: theme.colors.textMuted,
    marginBottom: 6,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 },
  hintText: { fontSize: 12, color: theme.colors.textMuted, marginBottom: 14, lineHeight: 17 },
  errorText: { color: theme.colors.expense, fontSize: 13, marginBottom: 12 },
  dangerLabel: {
    fontSize: 11,
    fontFamily: theme.font.bodyBold,
    color: theme.colors.textMuted,
    letterSpacing: 0.5,
    marginTop: 20,
    marginBottom: 8,
  },
  deleteButton: { backgroundColor: theme.colors.expenseTint, borderColor: theme.colors.expense },

  // ---- "You" / "Settings" segmented control, right below identity ----
  // SegmentedControl already draws its own pill/background — this just adds
  // the horizontal margin every other section on this screen has, which the
  // component itself has no opinion about.
  tabWrap: { marginHorizontal: 20, marginBottom: 6 },

  // ---- YouSection: goal strip, "See all" link ----
  goalStrip: { flexDirection: 'row', gap: 10, paddingHorizontal: 20 },
  seeAllLink: { fontSize: 12, fontFamily: theme.font.bodyMedium, color: theme.colors.textSecondary },

  // ---- YouSection section headers — matches Home's HomeSection heading, not
  // the colored SectionLabel pill, so the two screens read as one screen
  // when Budgets/Savings Goals appear on both (design sign-off: "one header
  // style, everywhere"). SectionLabel itself is kept only for the quieter
  // "ARCHIVED ACCOUNTS" row further down.
  sectionTitle: { fontFamily: theme.font.roundedBold, fontSize: 16, color: theme.colors.textPrimary },
  // Recurring's "See all" reads as an outlined pill instead of a bare text
  // link, so it sits at the same visual weight as the "+ Account"/"+ Add"
  // pills next to it — a different action (browse vs. create), not a
  // lesser one.
  // Matches Home's own "See all" (HomeSection.tsx) exactly — this used to be
  // a bordered pill, the only place in the app that affordance appeared;
  // unified to the plain text+arrow style used everywhere else.
  seeAll: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  seeAllText: { fontFamily: theme.font.bodyMedium, fontSize: 12, color: theme.colors.textSecondary },

  // ---- SettingsSection (formerly settings.tsx's own StyleSheet) ----
  groupTitle: {
    fontFamily: theme.font.bodyBold,
    fontSize: 11.5,
    color: theme.colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.7,
    marginHorizontal: 20,
    marginTop: 22,
    marginBottom: 8,
  },
  group: {
    marginHorizontal: 20,
    backgroundColor: theme.colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.borderSoft,
    borderRadius: theme.radius.lg,
    overflow: 'hidden',
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 13 },
  rowDivider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.colors.borderSoft },
  rowText: { flex: 1, minWidth: 0 },
  rowLabel: { fontFamily: theme.font.bodyMedium, fontSize: 14.5, color: theme.colors.textPrimary },
  rowSub: {
    fontFamily: theme.font.body,
    fontSize: 11.5,
    color: theme.colors.textMuted,
    marginTop: 2,
    lineHeight: 16,
  },
  rowValue: { fontFamily: theme.font.bodyBold, fontSize: 13, color: theme.colors.textSecondary },

  // The theme picker — one row per pack, each showing its primary/secondary
  // pair as a split-circle swatch. Replaced the old free-colour swatch grid;
  // see AccentContext/theme/themes.ts.
  themeList: { padding: 14, paddingTop: 12, gap: 8 },
  themeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 10,
    borderRadius: theme.radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.borderSoft,
    backgroundColor: theme.colors.surface,
  },
  themeCardActive: { borderColor: theme.colors.ink },
  themeSwatch: { width: 38, height: 38, borderRadius: 11, overflow: 'hidden', flexDirection: 'row' },
  themeSwatchHalf: { flex: 1, height: '100%' },
  themeInfo: { flex: 1, minWidth: 0 },
  themeName: { fontFamily: theme.font.roundedMedium, fontSize: 13.5, color: theme.colors.textPrimary },
  themeSub: { fontFamily: theme.font.body, fontSize: 11, color: theme.colors.textMuted, marginTop: 1 },
  themeCheck: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: theme.colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Compact Save/Clear pair inside the daily-spending-goal accordion —
  // deliberately smaller than the full-width PrimaryButton used in modal
  // footers, since this sits inline inside a settings row, not its own screen.
  dailyGoalBtnRow: { flexDirection: 'row', gap: 8, marginTop: 2 },
  dailyGoalBtn: { flex: 1, borderRadius: theme.radius.pill, paddingVertical: 9, alignItems: 'center' },
  dailyGoalBtnPrimary: { backgroundColor: theme.colors.ink },
  dailyGoalBtnPrimaryText: {
    fontFamily: theme.font.roundedBold,
    fontSize: 12.5,
    color: theme.colors.surface,
  },
  dailyGoalBtnGhost: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.borderSoft,
    backgroundColor: 'transparent',
  },
  dailyGoalBtnGhostText: {
    fontFamily: theme.font.roundedMedium,
    fontSize: 12.5,
    color: theme.colors.textMuted,
  },

  pickerHint: {
    fontFamily: theme.font.body,
    fontSize: 12.5,
    color: theme.colors.textMuted,
    lineHeight: 18,
    marginBottom: 12,
  },

  aboutCard: {
    marginHorizontal: 20,
    alignItems: 'center',
    padding: 20,
    backgroundColor: theme.colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.borderSoft,
    borderRadius: theme.radius.lg,
  },
  aboutName: {
    fontFamily: theme.font.roundedBold,
    fontSize: 20,
    color: theme.colors.textPrimary,
    marginTop: 10,
  },
  aboutTagline: { fontFamily: theme.font.body, fontSize: 12.5, color: theme.colors.textMuted, marginTop: 3 },
  aboutFacts: { alignSelf: 'stretch', gap: 10, marginTop: 18 },
  aboutFactRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  aboutFactText: {
    flex: 1,
    fontFamily: theme.font.body,
    fontSize: 12.5,
    color: theme.colors.textSecondary,
    lineHeight: 17,
  },
  aboutVersion: {
    fontFamily: theme.font.bodyBold,
    fontSize: 11,
    color: theme.colors.textMuted,
    marginTop: 18,
    letterSpacing: 0.4,
  },
  // Accordion body for the Theme/Currency rows below — expands in place
  // under the row that opened it, inside the same bordered group card, so
  // it reads as revealing more of the same row rather than a separate block.
  accordionBody: {
    paddingHorizontal: 12,
    paddingBottom: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.borderSoft,
  },
  rowPreviewSwatch: { width: 20, height: 20, borderRadius: 6, overflow: 'hidden', flexDirection: 'row' },
  rowPreviewSwatchHalf: { flex: 1 },

  pickerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 13 },
  codeBubble: {
    width: 44,
    height: 30,
    borderRadius: 9,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.borderSoft,
    backgroundColor: theme.colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  codeText: { fontFamily: theme.font.bodyBold, fontSize: 11, color: theme.colors.ink },
});
