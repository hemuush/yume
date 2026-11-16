import { memo, useCallback } from 'react';
import { View, Pressable, Animated, StyleSheet } from 'react-native';
import { Text } from '@/components/Text';
import Feather from '@expo/vector-icons/Feather';
import { theme } from '@/constants/theme';
import { usePressScale } from '@/lib/usePressScale';
import { haptics } from '@/lib/haptics';
import { PadKey } from '@/lib/padMath';
import { shade } from '@/lib/color';
import { themeInk } from '@/theme/interactionColors';
import { useAccent } from '@/theme/AccentContext';
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
  tone,
  children,
  keySurface,
}: {
  onKey: (key: PadKey) => void;
  onClear: () => void;
  /** The sum keys' wash and ink; defaults to the theme's sky. */
  tone?: { bg: string; ink: string };
  children: React.ReactNode;
  keySurface?: string;
}) {
  return (
    <View style={styles.pad}>
      {ROWS.map((row, r) => (
        <View key={r} style={styles.row}>
          {row.map((key) => (
            <KeyButton
              key={key}
              padKey={key}
              onKey={onKey}
              onClear={key === 'back' ? onClear : undefined}
              tone={tone}
              surface={keySurface}
            />
          ))}
        </View>
      ))}
      <View style={styles.row}>{children}</View>
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
  tone,
  surface,
}: {
  padKey: PadKey;
  onKey: (key: PadKey) => void;
  onClear: (() => void) | undefined;
  tone: { bg: string; ink: string } | undefined;
  surface: string | undefined;
}) {
  const onPress = useCallback(() => onKey(padKey), [onKey, padKey]);
  return <PadButton padKey={padKey} onPress={onPress} onLongPress={onClear} tone={tone} surface={surface} />;
});

export function PadButton({
  padKey,
  surface,
  onPress,
  onLongPress,
  compact,
  tone,
}: {
  padKey: PadKey;
  surface?: string;
  onPress: () => void;
  onLongPress?: () => void;
  /** A shorter key, for the pad docked under a sheet. */
  compact?: boolean;
  /** The sum keys' wash and ink (Add colours them by the entry's type). */
  tone?: { bg: string; ink: string };
}) {
  const { animatedStyle, onPressIn, onPressOut } = usePressScale(0.97);
  const uiScale = useUiScale();
  const operator = padKey === '÷' || padKey === '×' || padKey === '−' || padKey === '+';
  // The sum keys sit on a pale theme tint, so they stand apart from the digits.
  const { accent } = useAccent();
  const opTone = tone ?? { bg: shade(accent, 95), ink: themeInk(accent) };
  return (
    <AnimatedPressable
      style={[
        styles.key,
        surface && { backgroundColor: surface },
        compact && styles.keyCompact,
        { minHeight: Math.max(theme.accessibility.minTouchTarget, Math.ceil((compact ? 42 : 46) * uiScale)) },
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

const styles = themedStyles(() =>
  StyleSheet.create({
    pad: { gap: 8 },
    row: { flexDirection: 'row', gap: 8 },
    key: {
      flex: 1,
      minHeight: 46,
      borderRadius: theme.radius.md,
      alignItems: 'center',
      justifyContent: 'center',
      // The soft tray, so a key reads as a key on the cream panel it sits on.
      backgroundColor: theme.colors.tray,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.colors.borderSoft,
    },
    // The docked pad sits on a sheet's own cream, so its keys are the lighter surface with a hairline.
    keyCompact: {
      minHeight: 44,
      backgroundColor: theme.colors.tray,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.colors.borderSoft,
    },
    keyText: { fontFamily: theme.font.bodyMedium, fontSize: 20, color: theme.colors.textPrimary },
    keyOperatorText: { fontFamily: theme.font.bodyMedium, fontSize: 20, color: theme.colors.link },
  })
);
