import { View, Text, Pressable, Animated, StyleSheet } from 'react-native';
import { theme } from '@/constants/theme';
import { usePressScale } from '@/lib/usePressScale';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface Props<T extends string> {
  options: { label: string; value: T }[];
  value: T;
  onChange: (value: T) => void;
}

export function SegmentedControl<T extends string>({ options, value, onChange }: Props<T>) {
  return (
    <View style={styles.wrap}>
      {options.map((opt) => (
        <Segment
          key={opt.value}
          active={opt.value === value}
          label={opt.label}
          onPress={() => onChange(opt.value)}
        />
      ))}
    </View>
  );
}

function Segment({ active, label, onPress }: { active: boolean; label: string; onPress: () => void }) {
  const { animatedStyle, onPressIn, onPressOut } = usePressScale(0.95);
  return (
    <AnimatedPressable
      style={[styles.segment, active && styles.segmentActive, animatedStyle]}
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
    >
      <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{label}</Text>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    backgroundColor: theme.colors.surfaceAlt,
    borderRadius: theme.radius.pill,
    padding: 3,
    marginBottom: 14,
  },
  segment: { flex: 1, paddingVertical: 8, borderRadius: theme.radius.pill, alignItems: 'center' },
  segmentActive: {
    backgroundColor: theme.colors.surface,
    shadowColor: theme.colors.ink,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 2,
  },
  segmentText: { fontSize: 12.5, fontFamily: theme.font.roundedMedium, color: theme.colors.textSecondary },
  segmentTextActive: { color: theme.colors.textPrimary, fontFamily: theme.font.roundedBold },
});
