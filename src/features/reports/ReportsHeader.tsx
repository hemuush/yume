import { Pressable, StyleSheet } from 'react-native';
import { Text } from '@/components/Text';
import { theme } from '@/constants/theme';
import { ReportWindow, windowLabel } from '@/lib/period';
import { withPressed } from '@/lib/pressed';
import type { CollapsingHeader } from '@/lib/useCollapsingHeader';
import { SkyHeader } from '@/features/home/SkyHeader';
import { PeriodRow } from './PeriodRow';

/**
 * Reports' header: the shared sky band with the title and the period control in it. Given `collapse` it
 * shrinks as the report scrolls, and the period comes along as a small chip in the bar (tapping it scrolls
 * back up to the full control).
 */
export function ReportsHeader({
  cursor,
  onChange,
  collapse,
  summary,
  onChipPress,
}: {
  cursor: ReportWindow;
  onChange: (c: ReportWindow) => void;
  collapse?: CollapsingHeader;
  summary?: React.ReactNode;
  onChipPress?: () => void;
}) {
  const label = windowLabel(cursor);
  return (
    <SkyHeader
      title="Reports"
      collapse={collapse}
      summary={summary}
      collapsedAccessory={
        onChipPress ? (
          <Pressable
            onPress={onChipPress}
            hitSlop={8}
            style={withPressed(styles.chip)}
            accessibilityRole="button"
            accessibilityLabel={`${label}. Change the period`}
          >
            <Text style={styles.chipText} numberOfLines={1}>
              {label} ▾
            </Text>
          </Pressable>
        ) : undefined
      }
    >
      <PeriodRow cursor={cursor} onChange={onChange} />
    </SkyHeader>
  );
}

const styles = StyleSheet.create({
  chip: {
    height: 30,
    maxWidth: 150,
    paddingHorizontal: 12,
    borderRadius: theme.radius.pill,
    justifyContent: 'center',
    backgroundColor: `${theme.colors.surface}E6`,
  },
  chipText: { fontFamily: theme.font.bodyBold, fontSize: 12, color: theme.colors.textPrimary },
});
