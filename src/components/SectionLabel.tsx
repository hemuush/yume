import { View, Text, StyleSheet } from 'react-native';
import { theme } from '@/constants/theme';
import { useAccent } from '@/theme/AccentContext';

interface Props {
  children: string;
  color?: string;
  tint?: string;
}

/** A small colored tag instead of the generic gray-uppercase section header nearly every list-based app uses. */
export function SectionLabel({ children, color, tint }: Props) {
  const { accent, onAccent } = useAccent();
  const resolvedColor = color ?? onAccent;
  const resolvedTint = tint ?? accent;
  return (
    <View style={[styles.pill, { backgroundColor: resolvedTint }]}>
      <Text style={[styles.text, { color: resolvedColor }]}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 999,
    marginHorizontal: 20,
    marginTop: 22,
    marginBottom: 10,
  },
  text: {
    fontFamily: theme.font.bodyBold,
    fontSize: 12,
  },
});
