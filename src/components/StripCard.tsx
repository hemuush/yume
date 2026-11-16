import { View, StyleSheet } from 'react-native';
import { themedStyles } from '@/theme/themedStyles';

/** The small dot before a kicker, in a card's deeper shade. */
export function KickerDot({ color }: { color: string }) {
  return <View style={[styles.dot, { backgroundColor: color }]} />;
}

const styles = themedStyles(() =>
  StyleSheet.create({
    dot: { width: 6, height: 6, borderRadius: 3 },
  })
);
