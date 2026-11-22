import { StyleSheet } from 'react-native';
import { theme } from '@/constants/theme';
import { listScreenStyles } from '@/features/shared/listScreenStyles';
import { SECTION_TITLE, SECTION_GAP } from '@/constants/textStyles';
import { SCREEN, flatSection, groupedSurface } from '@/components/screenStyles';
import { themedStyles } from '@/theme/themedStyles';

export const GRID_GAP = 8;

// Shared by the Categories screen, its list section (CategorySection /
// CategoryTile / SubcategoryPill) and AddCategoryModal.
export const styles = themedStyles(() =>
  StyleSheet.create({
    ...listScreenStyles,
    sectionTitle: {
      ...SECTION_TITLE,
      marginHorizontal: SCREEN.gutter,
      marginTop: SECTION_GAP.top,
      marginBottom: SECTION_GAP.bottom,
    },
    screenIntro: { marginHorizontal: SCREEN.gutter, marginTop: theme.layout.screenTopGap, marginBottom: 10 },
    archiveTitle: { ...SECTION_TITLE, marginBottom: 10 },
    categorySearch: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: 14,
      borderRadius: theme.radius.pill,
      backgroundColor: theme.colors.home.control,
    },
    categorySearchInput: {
      flex: 1,
      minHeight: 44,
      paddingVertical: 8,
      fontFamily: theme.font.body,
      fontSize: 13,
      color: theme.colors.textPrimary,
    },
    categorySearchClear: { width: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
    emptyCard: { ...flatSection(), marginHorizontal: SCREEN.gutter, padding: 14, gap: 12 },
    emptyTitle: { fontFamily: theme.font.roundedBold, fontSize: 17, color: theme.colors.textPrimary },
    emptyText: {
      fontFamily: theme.font.body,
      fontSize: 13,
      lineHeight: 19,
      color: theme.colors.textSecondary,
    },
    categoryList: {
      ...groupedSurface.frame,
      marginHorizontal: SCREEN.gutter,
      overflow: 'hidden',
    },
    categoryDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.colors.divider },
    // An open parent: its subcategories are an indented list on a thin guide line under the parent's own name, in the same
    // white as the rows around it, so the parent and its children read as one block.
    panelWrap: { paddingStart: 42, paddingBottom: 6 },
    panel: { borderLeftWidth: 2, borderLeftColor: theme.colors.divider },
    parentEdit: {
      minHeight: 44,
      paddingHorizontal: 12,
      borderRadius: theme.radius.md,
      flexDirection: 'row',
      gap: 8,
      alignItems: 'center',
    },
    tileNested: { minHeight: 44 },
    parentEditText: { fontFamily: theme.font.bodyBold, fontSize: 13, color: theme.colors.link },
    hintText: {
      fontFamily: theme.font.body,
      fontSize: 12,
      color: theme.colors.textMuted,
      marginHorizontal: SCREEN.gutter,
      marginTop: 14,
      lineHeight: 17,
    },
    categoryRowShell: { flexDirection: 'row', alignItems: 'center', paddingRight: 4 },
    categoryMore: { width: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
    collectionAction: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 7,
      minHeight: 44,
      alignSelf: 'flex-start',
    },
    archivedLink: { marginHorizontal: SCREEN.gutter, marginTop: 6 },
    collectionActionText: { fontFamily: theme.font.bodyMedium, fontSize: 13, color: theme.colors.link },
    tile: {
      flex: 1,
      minWidth: 0,
      flexDirection: 'row',
      alignItems: 'center',
      minHeight: 48,
      paddingHorizontal: 12,
      paddingVertical: 6,
      gap: 10,
    },
    tileText: { flex: 1, minWidth: 0 },
    tileCount: {
      fontFamily: theme.font.body,
      fontSize: 12,
      lineHeight: 16,
      color: theme.colors.textMuted,
      marginTop: 3,
    },
    tileUses: { fontFamily: theme.font.body, fontSize: 12, color: theme.colors.textMuted },
    tileBadge: {
      minWidth: 20,
      paddingHorizontal: 6,
      borderRadius: 10,
      overflow: 'hidden',
      textAlign: 'center',
      fontFamily: theme.font.bodyMedium,
      fontSize: 11,
      lineHeight: 20,
      color: theme.colors.textSecondary,
      backgroundColor: theme.colors.home.control,
    },
    tileName: {
      fontSize: 14,
      lineHeight: 19,
      color: theme.colors.textPrimary,
      fontFamily: theme.font.bodyMedium,
    },
    identityRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 12 },
    // FormInput ends in a 12 dp margin of its own and its field is 52 dp tall: the disc takes the same 12 so that the two
    // share one bottom edge, and is 52 dp so that they share one height.
    identityDisc: {
      width: 52,
      height: 52,
      borderRadius: 26,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 12,
    },
    identityName: { flex: 1, minWidth: 0 },
    appearance: {
      marginVertical: 8,
      marginBottom: 12,
    },
    pickerLabel: {
      fontFamily: theme.font.bodyMedium,
      fontSize: 12,
      color: theme.colors.textSecondary,
      marginBottom: 10,
    },
    iconGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: GRID_GAP },
    iconChoice: {
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 14,
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.borderSoft,
    },
    iconChoiceActive: { borderColor: theme.colors.ink },
    moreIcons: {
      minHeight: 44,
      marginTop: 10,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
    },
    moreIconsText: { fontFamily: theme.font.bodyMedium, fontSize: 12, color: theme.colors.textSecondary },
    colorRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 0, marginBottom: 12 },
    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 },
    colorSwatch: {
      width: 44,
      height: 44,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 999,
      borderWidth: 1.5,
      borderColor: 'transparent',
    },
    colorSwatchFill: {
      width: 28,
      height: 28,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
    },
    colorSwatchActive: { borderColor: theme.colors.ink },
    parentChip: {
      minHeight: 48,
      maxWidth: '100%',
      justifyContent: 'center',
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: 999,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.colors.borderSoft,
      backgroundColor: theme.colors.surface,
    },
    parentChipText: {
      flexShrink: 1,
      fontSize: 12,
      fontFamily: theme.font.bodyMedium,
      color: theme.colors.textPrimary,
    },
  })
);
