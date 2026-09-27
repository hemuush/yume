import { View, StyleSheet } from 'react-native';
import { Text } from '@/components/Text';
import { FormInput } from '@/components/FormInput';
import { theme } from '@/constants/theme';

/**
 * A credit card's statement day and bill due day, side by side, on Add
 * account and Edit account. Both come from the card's own statement; left
 * empty, the card simply has no bill tracking.
 */
export function CardCycleFields({
  statementDay,
  dueDay,
  onChangeStatementDay,
  onChangeDueDay,
}: {
  statementDay: string;
  dueDay: string;
  onChangeStatementDay: (v: string) => void;
  onChangeDueDay: (v: string) => void;
}) {
  return (
    <View>
      <View style={styles.row}>
        <View style={styles.half}>
          <FormInput
            label="Statement day"
            value={statementDay}
            onChangeText={onChangeStatementDay}
            keyboardType="number-pad"
            placeholder="e.g. 5"
            maxLength={2}
          />
        </View>
        <View style={styles.half}>
          <FormInput
            label="Bill due day"
            value={dueDay}
            onChangeText={onChangeDueDay}
            keyboardType="number-pad"
            placeholder="e.g. 25"
            maxLength={2}
          />
        </View>
      </View>
      <Text style={styles.hint}>
        Both are on your card statement. Leave them empty if you don&rsquo;t want bill tracking.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 10 },
  half: { flex: 1 },
  // Sits under the fields and keeps the form's 14 gap before whatever follows.
  hint: {
    fontFamily: theme.font.body,
    fontSize: 12,
    lineHeight: 17,
    color: theme.colors.textMuted,
    marginTop: -6,
    marginBottom: 14,
  },
});
