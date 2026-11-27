import { StyleSheet } from 'react-native';
import { summaryInk } from '@/components/SummaryGradient';
import { theme } from '@/constants/theme';
import { themedStyles } from '@/theme/themedStyles';

export const styles = themedStyles(() =>
  StyleSheet.create({
    card: {
      marginHorizontal: 16,
      backgroundColor: theme.colors.home.surface,
      borderRadius: theme.radius.xl2,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.colors.home.edge,
      overflow: 'hidden',
      paddingHorizontal: 16,
      paddingTop: 8,
      paddingBottom: 0,
    },
    footer: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      justifyContent: 'space-between',
      columnGap: 12,
      minHeight: 44,
      alignContent: 'center',
    },
    hidden: {
      display: 'none',
    },
    weekTitle: {
      fontFamily: theme.font.bodyBold,
      fontSize: 13,
      color: theme.colors.textPrimary,
      marginBottom: 8,
    },
    bar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
      minHeight: 44,
      marginBottom: 8,
    },
    // The card ends on this now that the links row under the legend is gone.
    body: { gap: 2, paddingBottom: 12 },
    figure: {
      minWidth: 0,
      gap: 8,
      paddingHorizontal: 16,
      paddingTop: 10,
      paddingBottom: 8,
      marginBottom: 2,
      borderRadius: theme.radius.xl,
      overflow: 'hidden',
      backgroundColor: summaryInk.background,
    },

    headLabel: {
      flex: 1,
      minWidth: 0,
      fontFamily: theme.font.bodyMedium,
      fontSize: 14,
      color: theme.colors.home.secondaryText,
    },
    headValue: {
      fontFamily: theme.font.bodyBold,
      // The one number Home is about: larger than everything else, in the space the tighter padding gave back.
      fontSize: 32,
      fontVariant: ['tabular-nums'],
      lineHeight: 38,
      letterSpacing: -1.2,
      color: summaryInk.text,
    },
    headValueNeg: { color: summaryInk.negative },
    figureCaption: { fontFamily: theme.font.body, fontSize: 12, color: summaryInk.secondary },
    headCaption: {
      flexShrink: 1,
      fontFamily: theme.font.body,
      fontSize: 12,
      lineHeight: 17,
      color: theme.colors.home.secondaryText,
    },

    figureTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    figureTopStacked: { flexWrap: 'wrap', rowGap: 6 },
    figureValue: { flexShrink: 1, minWidth: 0, minHeight: 44, justifyContent: 'center' },
    howToggle: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    howToggleText: { flexShrink: 1, fontFamily: theme.font.bodyMedium, fontSize: 12, color: summaryInk.link },
    // The week (or insights) switch at the figure’s right, a pill on the sky.
    trendChip: {
      marginLeft: 'auto',
      flexShrink: 0,
      minHeight: 44,
      justifyContent: 'center',
    },
    trendPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      minHeight: 32,
      paddingHorizontal: 10,
      borderRadius: theme.radius.pill,
      backgroundColor: summaryInk.chip,
    },
    trendChipText: { fontFamily: theme.font.bodyMedium, fontSize: 12, color: summaryInk.link },
    howLink: { flexDirection: 'row', alignItems: 'center', gap: 5, minHeight: 44 },
    howLinkText: { fontFamily: theme.font.bodyMedium, fontSize: 12, color: theme.colors.link },

    insightsLink: {
      minHeight: 44,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'flex-end',
      gap: 4,
    },
    insightsText: { fontFamily: theme.font.bodyMedium, fontSize: 12, color: theme.colors.link },
    link: { minHeight: 44, justifyContent: 'center' },
    linkText: { fontFamily: theme.font.bodyMedium, fontSize: 13, color: theme.colors.link },

    workingLast: { marginBottom: 2 },
    working: {
      marginTop: 6,
      marginBottom: 12,
      borderRadius: theme.radius.lg,
      backgroundColor: theme.colors.home.control,
      paddingHorizontal: 14,
      paddingVertical: 8,
    },
    workingRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'baseline',
      justifyContent: 'space-between',
      gap: 8,
      paddingVertical: 5,
    },
    workingTotal: {
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: theme.colors.borderSoft,
      marginTop: 3,
      paddingTop: 8,
    },
    workingLabel: {
      flexGrow: 1,
      flexBasis: 140,
      fontFamily: theme.font.body,
      fontSize: 13,
      color: theme.colors.textSecondary,
    },
    workingLabelTotal: { fontFamily: theme.font.bodyBold, color: theme.colors.textPrimary },
    workingValue: {
      fontVariant: ['tabular-nums'],
      fontFamily: theme.font.bodyBold,
      fontSize: 13,
      color: theme.colors.textPrimary,
    },
    workingValueDue: { color: theme.colors.dueInk },
  })
);
