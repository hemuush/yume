import { StyleSheet } from 'react-native';
import { theme } from '@/constants/theme';
import { themedStyles } from '@/theme/themedStyles';

/** The paper itself between hairlines: no fill, no shadow, no rounded box. */
export const cardSurface = themedStyles(() =>
  StyleSheet.create({
    neutral: {
      backgroundColor: 'transparent',
      borderColor: theme.colors.borderSoft,
      boxShadow: 'none',
    },
    summary: {
      backgroundColor: 'transparent',
      borderColor: theme.colors.borderSoft,
      boxShadow: 'none',
    },
  })
);
