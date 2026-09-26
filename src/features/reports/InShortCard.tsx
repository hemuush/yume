import { View, Pressable, Animated, StyleSheet } from 'react-native';
import { Text } from '@/components/Text';
import Feather from '@expo/vector-icons/Feather';
import { theme } from '@/constants/theme';
import { BLOCK_GAP } from './reports.styles';
import { usePressScale } from '@/lib/usePressScale';
import type { InShortLine, InShortTarget } from './reportsInsights';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/** A pastel per kind of line — existing theme tints, inside the app's pastel band. */
const ICON_TINT: Record<InShortLine['icon'], string> = {
  'trending-up': theme.colors.expenseTint,
  calendar: theme.colors.accentTint,
  repeat: theme.colors.primaryTint,
};

/**
 * Reports' "In short": the few plain-language answers (see buildInShortLines)
 * right under the headline, before any chart. Each line jumps to the section
 * it came from. Renders nothing when there is nothing to say; says "too early"
 * rather than guessing when the period in progress has barely begun.
 */
export function InShortCard({
  lines,
  tooEarly,
  onJump,
}: {
  lines: InShortLine[];
  tooEarly: boolean;
  onJump: (target: InShortTarget) => void;
}) {
  if (!tooEarly && lines.length === 0) return null;
  return (
    <View style={styles.card}>
      <Text style={styles.title}>In short</Text>
      {tooEarly ? (
        <Text style={styles.early}>Too early to tell. Check back after a few more days.</Text>
      ) : (
        lines.map((line) => <InShortRow key={line.key} line={line} onPress={() => onJump(line.target)} />)
      )}
    </View>
  );
}

function InShortRow({ line, onPress }: { line: InShortLine; onPress: () => void }) {
  const { animatedStyle, onPressIn, onPressOut } = usePressScale(0.98);
  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      accessibilityRole="button"
      accessibilityLabel={`${line.bold ?? ''}${line.text}`}
      accessibilityHint="Shows the chart this comes from"
      style={[styles.row, animatedStyle]}
    >
      <View style={[styles.icon, { backgroundColor: ICON_TINT[line.icon] }]}>
        <Feather name={line.icon} size={12} color={theme.colors.ink} />
      </View>
      <Text style={styles.text}>
        {line.bold ? <Text style={styles.bold}>{line.bold}</Text> : null}
        {line.text}
      </Text>
      <Feather name="chevron-right" size={14} color={theme.colors.textMuted} />
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: BLOCK_GAP,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.xl2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.borderSoft,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 6,
  },
  title: {
    fontFamily: theme.font.roundedBold,
    fontSize: 15,
    color: theme.colors.textPrimary,
    marginBottom: 4,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 7 },
  icon: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  text: {
    flex: 1,
    fontFamily: theme.font.body,
    fontSize: 12.5,
    lineHeight: 17,
    color: theme.colors.textPrimary,
  },
  bold: { fontFamily: theme.font.bodyBold },
  early: {
    fontFamily: theme.font.body,
    fontSize: 12.5,
    color: theme.colors.textSecondary,
    paddingBottom: 8,
    lineHeight: 17,
  },
});
