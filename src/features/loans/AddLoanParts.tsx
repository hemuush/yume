import { selectedFill } from '@/theme/interactionColors';
import { View, Pressable, StyleSheet } from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Text } from '@/components/Text';
import { theme } from '@/constants/theme';
import { haptics } from '@/lib/haptics';
import type { McIconName } from '@/components/iconName';
import { useAccent } from '@/theme/AccentContext';

export interface Option<T extends string> {
  value: T;
  title: string;
  sub: string;
  icon: string;
}

/** Two big choices side by side, for a decision that deserves a line of explanation. */
export function OptionCards<T extends string>({
  options,
  value,
  onChange,
}: {
  options: Option<T>[];
  value: T;
  onChange: (next: T) => void;
}) {
  const { accent } = useAccent();
  return (
    <View style={styles.row}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            accessibilityRole="radio"
            accessibilityState={{ selected: active }}
            style={({ pressed }) => [
              styles.card,
              active && { backgroundColor: selectedFill(accent), borderColor: selectedFill(accent) },
              pressed && styles.pressed,
            ]}
          >
            <MaterialCommunityIcons
              name={o.icon as McIconName}
              size={20}
              color={active ? theme.colors.textPrimary : theme.colors.textMuted}
            />
            <View style={styles.copy}>
              <Text style={[styles.title, active && styles.titleActive]}>{o.title}</Text>
              <Text style={styles.sub}>{o.sub}</Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

/** A whole-number count with − and + buttons, kept between 0 and `max`. */
export function CountStepper({
  value,
  max,
  onChange,
  label,
}: {
  value: number;
  max: number;
  onChange: (next: number) => void;
  label: string;
}) {
  const step = (delta: number) => {
    const next = Math.min(max, Math.max(0, value + delta));
    if (next !== value) {
      haptics.tap();
      onChange(next);
    }
  };
  return (
    <View style={styles.stepper}>
      <Pressable
        onPress={() => step(-1)}
        disabled={value <= 0}
        accessibilityRole="button"
        accessibilityLabel={`Fewer ${label}`}
        style={({ pressed }) => [styles.stepBtn, value <= 0 && styles.stepOff, pressed && styles.pressed]}
      >
        <MaterialCommunityIcons name="minus" size={18} color={theme.colors.textPrimary} />
      </Pressable>
      <Text style={styles.count}>{value}</Text>
      <Pressable
        onPress={() => step(1)}
        disabled={value >= max}
        accessibilityRole="button"
        accessibilityLabel={`More ${label}`}
        style={({ pressed }) => [styles.stepBtn, value >= max && styles.stepOff, pressed && styles.pressed]}
      >
        <MaterialCommunityIcons name="plus" size={18} color={theme.colors.textPrimary} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  card: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: theme.colors.borderSoft,
    backgroundColor: theme.colors.surface,
  },
  pressed: { opacity: 0.7 },
  copy: { flex: 1, minWidth: 0 },
  title: {
    fontFamily: theme.font.roundedMedium,
    fontSize: 13,
    color: theme.colors.textSecondary,
  },
  titleActive: { fontFamily: theme.font.roundedBold, color: theme.colors.textPrimary },
  sub: { fontFamily: theme.font.body, fontSize: 12, lineHeight: 15, color: theme.colors.textMuted },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 14 },
  stepBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surfaceAlt,
  },
  stepOff: { opacity: 0.4 },
  count: {
    minWidth: 48,
    textAlign: 'center',
    fontFamily: theme.font.monoBold,
    fontSize: 22,
    color: theme.colors.textPrimary,
  },
});
