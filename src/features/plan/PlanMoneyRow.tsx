import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from '@/components/Text';
import { GrowFill } from '@/components/GrowFill';
import { theme } from '@/constants/theme';
import { withPressedTint } from '@/lib/pressed';
import { useAccent } from '@/theme/AccentContext';
import { useStacked } from '@/lib/useStacked';
import { themedStyles } from '@/theme/themedStyles';

/**
 * The one row of Plan › Money plan, for a budget, a goal and a holding alike: an icon disc, a name with one quiet
 * line under it, the amount that matters at the right with its note under it, and an optional bar beneath the text.
 * `trailing` is the row's own action (a budget's ⋯, a goal's add button). Large text moves the amount below the name.
 */
export function PlanMoneyRow({
  icon,
  title,
  subtitle,
  value,
  note,
  progress,
  trailing,
  divider,
  highlight,
  onPress,
  onLongPress,
  accessibilityLabel,
  accessibilityHint,
}: {
  icon: React.ReactNode;
  title: string;
  /** Under the name: a line of muted text, or a few. */
  subtitle?: React.ReactNode;
  /** The figure, drawn with `planRowText.value`. */
  value: React.ReactNode;
  /** Under the figure, drawn with `planRowText.note`. */
  note?: React.ReactNode;
  /** A bar under the text: how full (0–100), in what colour, and which bar it is (it glides to a new value). */
  progress?: { pct: number; color: string; animKey: string };
  trailing?: React.ReactNode;
  divider?: boolean;
  /** A pale amber panel behind the row (a bill due soon). */
  highlight?: boolean;
  onPress: () => void;
  onLongPress?: () => void;
  /** Left out, the row is read from its text. */
  accessibilityLabel?: string;
  accessibilityHint?: string;
}) {
  const { accent } = useAccent();
  const stacked = useStacked();
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      style={withPressedTint(accent, [s.row, divider && s.divider, highlight && s.highlight])}
    >
      <View style={s.icon}>{icon}</View>
      <View style={s.body}>
        <View style={[s.line, stacked && s.stacked]}>
          <View style={s.copy}>
            <Text style={s.title}>{title}</Text>
            {subtitle}
          </View>
          <View style={[s.figure, stacked && s.figureStacked]}>
            {value}
            {note}
          </View>
        </View>
        {progress && (
          <View style={s.track} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            <GrowFill
              animKey={progress.animKey}
              pct={progress.pct}
              style={[s.fill, { backgroundColor: progress.color }]}
            />
          </View>
        )}
      </View>
      {trailing}
    </Pressable>
  );
}

/** The text roles of a row's subtitle, figure and note, so a list built on it reads the same everywhere. */
export const planRowText = themedStyles(() =>
  StyleSheet.create({
    subtitle: {
      fontFamily: theme.font.body,
      fontSize: 12,
      lineHeight: 16,
      color: theme.colors.home.secondaryText,
    },
    value: {
      fontFamily: theme.font.bodyBold,
      fontSize: 15,
      lineHeight: 20,
      textAlign: 'right',
      color: theme.colors.textPrimary,
      fontVariant: ['tabular-nums'],
    },
    note: {
      fontFamily: theme.font.body,
      fontSize: 12,
      lineHeight: 16,
      textAlign: 'right',
      color: theme.colors.textMuted,
    },
    warn: { color: theme.colors.warnInk },
    bad: { color: theme.colors.expenseText },
    good: { color: theme.colors.incomeText },
  })
);

const s = themedStyles(() =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 12,
      paddingLeft: 14,
      paddingRight: 10,
      minHeight: 64,
    },
    divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.colors.home.edge },
    highlight: {
      marginHorizontal: 8,
      marginVertical: 4,
      paddingHorizontal: 6,
      borderRadius: 18,
      borderTopWidth: 0,
      backgroundColor: theme.colors.dueRow,
    },
    icon: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
    body: { flex: 1, minWidth: 0, gap: 8 },
    line: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    stacked: { flexDirection: 'column', alignItems: 'flex-start', gap: 4 },
    copy: { flex: 1, minWidth: 0, gap: 2 },
    title: {
      fontFamily: theme.font.bodyMedium,
      fontSize: 15,
      lineHeight: 20,
      color: theme.colors.textPrimary,
    },
    figure: { flexShrink: 1, alignItems: 'flex-end', gap: 2 },
    figureStacked: { alignItems: 'flex-start' },
    track: { height: 6, borderRadius: 3, backgroundColor: theme.colors.home.control, overflow: 'hidden' },
    fill: { height: 6, borderRadius: 3 },
  })
);
