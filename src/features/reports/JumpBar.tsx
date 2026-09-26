import { View, Pressable } from 'react-native';
import { Text } from '@/components/Text';
import { StoryTarget } from './reportsInsights';
import { styles } from './reports.styles';

export type ReportSection = StoryTarget;

const SECTIONS: [ReportSection, string][] = [
  ['overview', 'Overview'],
  ['categories', 'Categories'],
  ['trends', 'Trends'],
];

/** Overview / Categories / Trends chips, pinned above Reports' scroll, lighting the section in view. */
export function JumpBar({ active, onJump }: { active: ReportSection; onJump: (s: ReportSection) => void }) {
  return (
    <View style={styles.jumpBar}>
      {SECTIONS.map(([key, label]) => (
        <Pressable
          key={key}
          onPress={() => onJump(key)}
          style={[styles.jumpChip, active === key && styles.jumpChipOn]}
          accessibilityRole="button"
          accessibilityState={{ selected: active === key }}
        >
          <Text style={[styles.jumpChipText, active === key && styles.jumpChipTextOn]}>{label}</Text>
        </Pressable>
      ))}
    </View>
  );
}
