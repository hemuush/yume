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
      paddingTop: 4,
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
    },
    body: { gap: 2 },
    figure: {
      minWidth: 0,
      gap: 4,
      paddingHorizontal: 16,
      paddingTop: 12,
      paddingBottom: 10,
      marginBottom: 4,
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
      fontSize: 28,
      fontVariant: ['tabular-nums'],
      lineHeight: 34,
      letterSpacing: -1,
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
