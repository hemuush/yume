import { View, Pressable, Animated, StyleSheet } from 'react-native';
import { Text } from '@/components/Text';
import Feather from '@expo/vector-icons/Feather';
import { theme } from '@/constants/theme';
import { usePressScale } from '@/lib/usePressScale';
import { haptics } from '@/lib/haptics';
import { PadKey } from './padMath';

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
  children,
}: {
  onKey: (key: PadKey) => void;
  onClear: () => void;
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
}: {
  padKey: PadKey;
  onPress: () => void;
  onLongPress?: () => void;
  /** A shorter key, for the pad docked under a sheet. */
  compact?: boolean;
}) {
  const { animatedStyle, onPressIn, onPressOut } = usePressScale(0.94);
  const operator = padKey === '÷' || padKey === '×' || padKey === '−' || padKey === '+';
  return (
    <AnimatedPressable
      style={[styles.key, compact && styles.keyCompact, operator && styles.keyOperator, animatedStyle]}
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
        <Text style={[styles.keyText, operator && styles.keyOperatorText]}>{padKey}</Text>
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
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surfaceAlt,
  },
  // The docked pad sits on a sheet's own cream, so its keys are the lighter surface with a hairline.
  keyCompact: {
    height: 42,
    backgroundColor: theme.colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.borderSoft,
  },
  keyOperator: { backgroundColor: theme.colors.accentTint },
  keyText: { fontFamily: theme.font.monoBold, fontSize: 18, color: theme.colors.textPrimary },
  keyOperatorText: { fontFamily: theme.font.monoBold, fontSize: 19 },
});
