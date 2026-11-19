import { memo, useCallback } from 'react';
import { View, Pressable, Animated, StyleSheet } from 'react-native';
import { Text } from '@/components/Text';
import Feather from '@expo/vector-icons/Feather';
import { theme } from '@/constants/theme';
import { usePressScale } from '@/lib/usePressScale';
import { haptics } from '@/lib/haptics';
import { PadKey } from '@/lib/padMath';
import { useUiScale } from '@/lib/uiScale';
import { themedStyles } from '@/theme/themedStyles';

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
  children?: React.ReactNode;
}) {
  return (
    <View style={styles.pad}>
      <View style={styles.keypadSurface}>
        {ROWS.map((row, r) => (
          <View key={r} style={styles.row}>
            {row.map((key) => (
              <KeyButton
                key={key}
                padKey={key}
                onKey={onKey}
                onClear={key === 'back' ? onClear : undefined}
              />
            ))}
          </View>
        ))}
      </View>
      {children && <View style={styles.row}>{children}</View>}
    </View>
  );
}

/**
 * One key of the pad. It compares its props by identity, so a pad whose keys, clear command and colours are the same is
 * not drawn again when what is around it is (every digit typed redraws the footer that holds it).
 */
const KeyButton = memo(function KeyButton({
  padKey,
  onKey,
  onClear,
}: {
  padKey: PadKey;
  onKey: (key: PadKey) => void;
  onClear: (() => void) | undefined;
}) {
  const onPress = useCallback(() => onKey(padKey), [onKey, padKey]);
  return <PadButton ledgerStyle padKey={padKey} onPress={onPress} onLongPress={onClear} />;
});

export function PadButton({
  padKey,
  onPress,
  onLongPress,
  compact,
  ledgerStyle = false,
}: {
  padKey: PadKey;
  onPress: () => void;
  onLongPress?: () => void;
  /** A shorter key, for the pad docked under a sheet. */
  compact?: boolean;
  ledgerStyle?: boolean;
}) {
  const { animatedStyle, onPressIn, onPressOut } = usePressScale(0.97);
  const uiScale = useUiScale();
  const operator = padKey === '÷' || padKey === '×' || padKey === '−' || padKey === '+';
  return (
    <AnimatedPressable
      style={[
        styles.key,
        compact && styles.keyCompact,
        {
          minHeight: Math.max(
            theme.accessibility.minTouchTarget,
            Math.ceil((compact ? 42 : ledgerStyle ? 44 : 46) * uiScale)
          ),
        },
        ledgerStyle && styles.ledgerKey,
        ledgerStyle && operator && styles.ledgerOperator,
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
        <Text style={[styles.keyText, operator && styles.keyOperatorText, ledgerStyle && styles.ledgerText]}>
          {padKey}
        </Text>
      )}
    </AnimatedPressable>
  );
}

const styles = themedStyles(() =>
  StyleSheet.create({
    pad: { gap: 8 },
    row: { flexDirection: 'row', gap: 6 },
    keypadSurface: {
      borderRadius: theme.radius.lg,
      backgroundColor: theme.colors.entry.keySurface,
      gap: 2,
      padding: 4,
    },
    // Plain digits on the page: no key boxes. The sum keys are the same, in the quieter ink.
    key: {
      flex: 1,
      minHeight: 46,
      alignItems: 'center',
      justifyContent: 'center',
    },
    keyCompact: { minHeight: 44 },
    ledgerKey: { borderRadius: theme.radius.md },
    ledgerOperator: { flex: 0.78, backgroundColor: theme.colors.entry.control },
    ledgerText: { fontSize: 19 },
    keyText: { fontFamily: theme.font.bodyMedium, fontSize: 22, color: theme.colors.textPrimary },
    keyOperatorText: { fontFamily: theme.font.body, fontSize: 22, color: theme.colors.textSecondary },
  })
);
