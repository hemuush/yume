import { useEffect, useState } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { Text } from './Text';
import { theme } from '@/constants/theme';
import { useReduceMotion } from '@/lib/useReduceMotion';

/** A single short fade; the result and actions never wait for decorative motion. */
export function CompletionCard({
  title,
  detail,
  children,
}: {
  title: string;
  detail: string;
  children?: React.ReactNode;
}) {
  const reduce = useReduceMotion();
  const [opacity] = useState(() => new Animated.Value(reduce ? 1 : 0));
  useEffect(() => {
    opacity.stopAnimation();
    if (reduce) {
      opacity.setValue(1);
      return;
    }
    const animation = Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true });
    animation.start();
    return () => animation.stop();
  }, [opacity, reduce]);
  return (
    <Animated.View style={[styles.card, { opacity }]}>
      <View style={styles.badge} accessible={false}>
        <Feather name="check" size={28} color={theme.colors.incomeText} />
      </View>
      <Text style={styles.title} accessibilityRole="header">
        {title}
      </Text>
      <Text style={styles.detail}>{detail}</Text>
      {children}
    </Animated.View>
  );
}
const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.borderSoft,
    padding: 20,
    gap: 12,
  },
  badge: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: theme.colors.incomeTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontFamily: theme.font.roundedBold, fontSize: 22, color: theme.colors.ink },
  detail: { fontFamily: theme.font.body, fontSize: 14, lineHeight: 21, color: theme.colors.textSecondary },
});
