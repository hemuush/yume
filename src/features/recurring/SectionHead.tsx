import { View, StyleSheet } from 'react-native';
import { Text } from '@/components/Text';
import { theme } from '@/constants/theme';
import { SECTION_GAP, SECTION_TITLE } from '@/constants/textStyles';

/** A heading above a card on Recurring: the rounded title, and a small note on the right. */
export function SectionHead({ title, note }: { title: string; note?: string }) {
  return (
    <View style={styles.head}>
      <Text style={styles.title}>{title}</Text>
      {!!note && <Text style={styles.note}>{note}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  head: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginTop: SECTION_GAP.top,
    marginBottom: SECTION_GAP.bottom,
  },
  title: SECTION_TITLE,
  note: { fontFamily: theme.font.bodyMedium, fontSize: 12, color: theme.colors.textSecondary },
});
