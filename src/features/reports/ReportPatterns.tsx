import { useState } from 'react';
import Animated, { FadeIn, ReduceMotion } from 'react-native-reanimated';
import { View, Pressable, StyleSheet } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { Text } from '@/components/Text';
import { theme } from '@/constants/theme';
import { withPressed } from '@/lib/pressed';
/** Secondary analysis stays discoverable without making the day view a long dashboard. */
export function ReportPatterns({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <View style={s.block}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Spending patterns"
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen((v) => !v)}
        style={withPressed(s.trigger)}
      >
        <View style={s.copy}>
          <Text style={s.title}>Spending patterns</Text>
          <Text style={s.caption}>Explore the details behind your spending</Text>
        </View>
        <Feather name={open ? 'chevron-up' : 'chevron-down'} size={18} color={theme.colors.textSecondary} />
      </Pressable>
      {open && (
        <Animated.View entering={FadeIn.duration(140).reduceMotion(ReduceMotion.System)} style={s.content}>
          {children}
        </Animated.View>
      )}
    </View>
  );
}
const s = StyleSheet.create({
  block: { marginTop: 12 },
  trigger: {
    minHeight: 60,
    padding: 14,
    borderRadius: 22,
    backgroundColor: theme.colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  copy: { flex: 1, gap: 4 },
  title: { fontFamily: theme.font.roundedBold, fontSize: 14, color: theme.colors.textPrimary },
  caption: { fontFamily: theme.font.body, fontSize: 12, color: theme.colors.textSecondary },
  content: { paddingTop: 12 },
});
