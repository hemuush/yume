import { View, StyleSheet, useWindowDimensions, StyleProp, ViewStyle } from 'react-native';
import { Text } from '@/components/Text';
import { SCREEN, screenStyles } from '@/components/screenStyles';
import { theme } from '@/constants/theme';

/**
 * The flat summary card a screen leads with (Home, Activity, Reports, Loans, and now Budgets, Recurring,
 * Investments and Friends & family): a small label over a 20 px figure with a side note, one slim bar, then a row
 * of facts. The pieces are shared so every screen's first card is the same size and shape.
 */

export type FactTone = 'good' | 'bad' | 'warn';

export interface SummaryFact {
  label: string;
  value: string;
  tone?: FactTone;
}

const TONE: Record<FactTone, string> = {
  good: theme.colors.incomeText,
  bad: theme.colors.expenseText,
  warn: theme.colors.warnInk,
};

/** The card itself: surface fill, soft border and a lifted shadow, on the screen gutter under the header. */
export function SummaryCard({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return <View style={[screenStyles.card, styles.card, style]}>{children}</View>;
}

/** A flat card holding a list of rows, on the screen gutter; the rows divide themselves. */
export function ListCard({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.list, style]}>{children}</View>;
}

/** The label over the figure on the left, and a short note on the right (see SummarySide). */
export function SummaryTop({
  label,
  figure,
  side,
}: {
  label: string;
  /** The figure, usually a CountUpAmount styled with `summaryFigure`. */
  figure: React.ReactNode;
  side?: React.ReactNode;
}) {
  return (
    <View style={styles.top}>
      <View style={styles.topMain}>
        <Text style={styles.label}>{label}</Text>
        {figure}
      </View>
      {side}
    </View>
  );
}

/** A bold line over a muted one, right-aligned beside the figure. */
export function SummarySide({ main, note, tone }: { main: string; note?: string; tone?: FactTone }) {
  return (
    <View style={styles.side}>
      <Text style={[styles.sideMain, !!tone && { color: TONE[tone] }]} numberOfLines={2}>
        {main}
      </Text>
      {!!note && (
        <Text style={styles.sideNote} numberOfLines={2}>
          {note}
        </Text>
      )}
    </View>
  );
}

/** Small label-and-value facts in a wrapping row; a column keeps its width as text grows and the row wraps. */
export function SummaryFacts({ facts }: { facts: SummaryFact[] }) {
  const { fontScale } = useWindowDimensions();
  if (facts.length === 0) return null;
  const basis = Math.round(84 * Math.min(2, Math.max(1, fontScale)));
  return (
    <View style={styles.facts}>
      {facts.map((fact) => (
        <View key={fact.label} style={[styles.fact, { flexBasis: basis }]}>
          <Text style={styles.factLabel}>{fact.label}</Text>
          <Text style={[styles.factValue, !!fact.tone && { color: TONE[fact.tone] }]}>{fact.value}</Text>
        </View>
      ))}
    </View>
  );
}

/** A slim bar split into coloured parts by weight; decorative, so hidden from screen readers. */
export function SummarySplit({ parts }: { parts: { key: string; weight: number; color: string }[] }) {
  const shown = parts.filter((p) => p.weight > 0);
  if (shown.length === 0) return null;
  return (
    <View style={styles.split} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {shown.map((p) => (
        <View key={p.key} style={[styles.segment, { flexGrow: p.weight, backgroundColor: p.color }]} />
      ))}
    </View>
  );
}

/** The figure's text style: pass it to CountUpAmount or a Text. */
export const summaryFigure = {
  fontFamily: theme.font.bodyMedium,
  fontSize: 20,
  lineHeight: 26,
  letterSpacing: -0.2,
  fontVariant: ['tabular-nums'],
  color: theme.colors.textPrimary,
} as const;

/** A short line of supporting text inside the card. */
export const summaryNote = {
  fontFamily: theme.font.body,
  fontSize: 12,
  lineHeight: 17,
  color: theme.colors.textSecondary,
} as const;

const styles = StyleSheet.create({
  card: {
    marginHorizontal: SCREEN.gutter,
    marginTop: theme.layout.screenTopGap,
    padding: 14,
    gap: 12,
    boxShadow: '0px 1px 2px rgba(18,19,15,0.04), 0px 8px 24px rgba(18,19,15,0.05)',
    overflow: 'visible',
  },
  list: {
    marginHorizontal: SCREEN.gutter,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.borderSoft,
    overflow: 'hidden',
  },
  top: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    columnGap: 12,
    rowGap: 4,
    paddingHorizontal: 2,
  },
  topMain: { flexShrink: 1, minWidth: 0 },
  label: { fontFamily: theme.font.body, fontSize: 12, color: theme.colors.textSecondary },
  side: { flexShrink: 1, alignItems: 'flex-end' },
  sideMain: {
    fontFamily: theme.font.bodyMedium,
    fontSize: 13,
    color: theme.colors.textPrimary,
    textAlign: 'right',
  },
  sideNote: { fontFamily: theme.font.body, fontSize: 11, color: theme.colors.textMuted, textAlign: 'right' },
  facts: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 12, rowGap: 8, paddingHorizontal: 2 },
  fact: { flexGrow: 1, minWidth: 0 },
  factLabel: { fontFamily: theme.font.body, fontSize: 12, color: theme.colors.textSecondary },
  factValue: {
    fontFamily: theme.font.bodyMedium,
    fontSize: 14,
    fontVariant: ['tabular-nums'],
    color: theme.colors.textPrimary,
  },
  split: { flexDirection: 'row', gap: 3, height: 8, borderRadius: 4, overflow: 'hidden' },
  segment: { flexBasis: 0, minWidth: 6, height: 8, borderRadius: 4 },
});
