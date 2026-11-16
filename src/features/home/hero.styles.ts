import { StyleSheet } from 'react-native';
import { theme } from '@/constants/theme';
import { themedStyles } from '@/theme/themedStyles';

export const styles = themedStyles(() =>
  StyleSheet.create({
    // Hero card: a true raised card with a subtle shadow for depth over the flat paper background.
    card: {
      marginHorizontal: 16,
      backgroundColor: theme.colors.surface,
      borderRadius: theme.radius.xl2,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.colors.borderSoft,
      paddingHorizontal: 18,
      paddingTop: 16,
      paddingBottom: 8,
      shadowColor: theme.colors.ink,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.05,
      shadowRadius: 10,
      elevation: 2,
    },
    // The ring sits in the middle of the card; a little more breathing room above.
    heroRow: { alignItems: 'center', marginTop: 10, marginBottom: 2 },
    // The week's spending card — matches the hero card for visual consistency.
    rhythm: {
      marginHorizontal: 16,
      backgroundColor: theme.colors.surface,
      borderRadius: theme.radius.xl2,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.colors.borderSoft,
      paddingHorizontal: 18,
      paddingTop: 16,
      paddingBottom: 16,
      shadowColor: theme.colors.ink,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.04,
      shadowRadius: 8,
      elevation: 2,
    },
    footer: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      justifyContent: 'space-between',
      columnGap: 12,
      marginTop: 8,
      minHeight: 44,
      alignContent: 'center',
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: theme.colors.divider,
    },
    actions: { marginHorizontal: 16, marginTop: 14 },
    bar: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
      minHeight: 32,
    },
    body: { gap: 4 },
    figure: { alignSelf: 'stretch', minWidth: 0 },

    headLabel: {
      fontFamily: theme.font.bodyBold,
      fontSize: 11,
      letterSpacing: 0.6,
      textTransform: 'uppercase',
      color: theme.colors.textMuted,
    },
    headValue: {
      fontFamily: theme.font.bodyMedium,
      fontSize: 30,
      textAlign: 'center',
      fontVariant: ['tabular-nums'],
      lineHeight: 36,
      letterSpacing: -0.5,
      color: theme.colors.textPrimary,
    },
    headValueNeg: { color: theme.colors.expenseText },
    headCaptionFull: { flexBasis: '100%', marginTop: -6, paddingBottom: 8 },
    headCaption: {
      flexShrink: 1,
      fontFamily: theme.font.body,
      fontSize: 12,
      lineHeight: 17,
      color: theme.colors.textMuted,
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
      backgroundColor: theme.colors.surfaceAlt,
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
