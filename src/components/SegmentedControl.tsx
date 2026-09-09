import { View, Text, Pressable, StyleSheet } from 'react-native';
import { theme } from '@/constants/theme';

interface Props<T extends string> {
  options: { label: string; value: T }[];
  value: T;
  onChange: (value: T) => void;
}

export function SegmentedControl<T extends string>({ options, value, onChange }: Props<T>) {
  return (
    <View style={styles.wrap}>
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <Pressable
            key={opt.value}
            style={[styles.segment, active && styles.segmentActive]}
            onPress={() => onChange(opt.value)}
          >
            <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{opt.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    backgroundColor: theme.colors.surfaceAlt,
    borderRadius: 10,
    padding: 4,
    marginBottom: 14,
  },
  segment: { flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: 'center' },
  segmentActive: { backgroundColor: theme.colors.surface },
  segmentText: { fontSize: 13, fontFamily: theme.font.bodyBold, color: theme.colors.textSecondary },
  segmentTextActive: { color: theme.colors.textPrimary },
});
