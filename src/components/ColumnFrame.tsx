import type { ReactNode } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { theme } from '@/constants/theme';

/**
 * The widest the app's content gets, in dp. A phone is narrower and is untouched. Android 16 ignores the
 * portrait lock on a tablet or an unfolded foldable (600 dp and wider), where every screen would otherwise stretch
 * to the full width: there the app is one centred column, with the background on either side.
 * shortcut: one width for every screen; give a screen that wants more (a table, a chart) its own when one does.
 */
export const MAX_CONTENT_WIDTH = 600;

/** Sheets and dialogs are their own windows, so they cap themselves to the same column. */
export const sheetWidth = { alignSelf: 'center', width: '100%', maxWidth: MAX_CONTENT_WIDTH } as const;
export const dialogWidth = { alignSelf: 'center', width: '100%', maxWidth: MAX_CONTENT_WIDTH - 48 } as const;

export function ColumnFrame({ children }: { children: ReactNode }) {
  return (
    <View style={styles.outside}>
      <View style={styles.column}>{children}</View>
    </View>
  );
}

/** The width the content really has: what a placeholder drawn from the screen's width should use. */
export function useContentWidth(): number {
  return Math.min(useWindowDimensions().width, MAX_CONTENT_WIDTH);
}

const styles = StyleSheet.create({
  outside: { flex: 1, alignItems: 'center', backgroundColor: theme.colors.background },
  column: { flex: 1, width: '100%', maxWidth: MAX_CONTENT_WIDTH },
});
