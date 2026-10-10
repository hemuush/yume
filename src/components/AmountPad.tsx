import { View, Pressable, Animated, StyleSheet } from 'react-native';
import { Text } from '@/components/Text';
import Feather from '@expo/vector-icons/Feather';
import { theme } from '@/constants/theme';
import { usePressScale } from '@/lib/usePressScale';
import { haptics } from '@/lib/haptics';
import { PadKey } from '@/lib/padMath';
import { shade } from '@/lib/color';
import { useAccent } from '@/theme/AccentContext';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const ROWS: PadKey[][] = [
  ['7', '8', '9', '÷'],
  ['4', '5', '6', '×'],
  ['1', '2', '3', '−'],
  ['.', '0', 'back', '+'],
];
const LABELS: Partial<Record<PadKey, string>> = {
  '÷': 'divide',
  '×': 'times',
  '−': 'minus',
  '+': 'plus',
  '.': 'decimal point',
  back: 'delete',
};

/**
 * The Add screen's own number pad instead of the phone keyboard: keeps the category grid in view and does
 * sums (padMath.ts). `children` is the last row (Add to list, Save). Long-press ⌫ clears the amount.
 */
export function AmountPad({
  onKey,
  onClear,
  tone,
  children,
}: {
  onKey: (key: PadKey) => void;
  onClear: () => void;
  /** The sum keys' wash and ink; defaults to the theme's sky. */
  tone?: { bg: string; ink: string };
  children: React.ReactNode;
}) {
  return (
    <View style={styles.pad}>
      {ROWS.map((row, r) => (
        <View key={r} style={styles.row}>
          {row.map((key) => (
            <PadButton
              key={key}
              padKey={key}
              onPress={() => onKey(key)}
              onLongPress={key === 'back' ? onClear : undefined}
              tone={tone}
            />
          ))}
        </View>
      ))}
      <View style={styles.row}>{children}</View>
    </View>
  );
}

export function PadButton({
  padKey,
  onPress,
  onLongPress,
  compact,
  tone,
}: {
  padKey: PadKey;
  onPress: () => void;
  onLongPress?: () => void;
  /** A shorter key, for the pad docked under a sheet. */
  compact?: boolean;
  /** The sum keys' wash and ink (Add colours them by the entry's type). */
  tone?: { bg: string; ink: string };
}) {
  const { animatedStyle, onPressIn, onPressOut } = usePressScale(0.97);
  const operator = padKey === '÷' || padKey === '×' || padKey === '−' || padKey === '+';
  // The sum keys sit on a pale theme tint, so they stand apart from the digits.
  const { accent } = useAccent();
  const opTone = tone ?? { bg: shade(accent, 95), ink: theme.colors.link };
  return (
    <AnimatedPressable
      style={[
        styles.key,
        compact && styles.keyCompact,
        operator && { backgroundColor: opTone.bg, borderColor: opTone.bg },
        animatedStyle,
      ]}
      onPress={() => {
        haptics.tap();
        onPress();
      }}
      onLongPress={
        onLongPress &&
        (() => {
          haptics.warn();
          onLongPress();
        })
      }
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      accessibilityRole="button"
      accessibilityLabel={LABELS[padKey] ?? padKey}
      accessibilityHint={padKey === 'back' ? 'Hold to clear the amount' : undefined}
    >
      {padKey === 'back' ? (
        <Feather name="delete" size={19} color={theme.colors.ink} />
      ) : (
        <Text style={[styles.keyText, operator && [styles.keyOperatorText, { color: opTone.ink }]]}>
          {padKey}
        </Text>
      )}
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  pad: { gap: 7 },
  row: { flexDirection: 'row', gap: 7 },
  key: {
    flex: 1,
    height: 46,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.borderSoft,
  },
  // The docked pad sits on a sheet's own cream, so its keys are the lighter surface with a hairline.
  keyCompact: {
    height: 42,
    backgroundColor: theme.colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.borderSoft,
  },
  keyText: { fontFamily: theme.font.bodyMedium, fontSize: 20, color: theme.colors.textPrimary },
  keyOperatorText: { fontFamily: theme.font.bodyMedium, fontSize: 20, color: theme.colors.link },
});
