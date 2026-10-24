import { View, StyleSheet } from 'react-native';
import { Text } from '@/components/Text';
import { AmountField } from '@/components/AmountField';
import { theme } from '@/constants/theme';

/**
 * A credit card's statement day and bill due day, side by side (Add/Edit account), taken from its statement.
 * Left empty, the card has no bill tracking.
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
          <AmountField
            decimal={false}
            label="Statement day"
            value={statementDay}
            onChangeText={onChangeStatementDay}
            placeholder="e.g. 5"
            maxLength={2}
          />
        </View>
        <View style={styles.half}>
          <AmountField
            decimal={false}
            label="Bill due day"
            value={dueDay}
            onChangeText={onChangeDueDay}
            placeholder="e.g. 25"
            maxLength={2}
          />
        </View>
      </View>
      <Text style={styles.hint}>Both are on your card statement. Leave empty to skip bill tracking.</Text>
    </View>
  );
}

/**
 * A card's minimum due as its statement states it: a share of the bill and the least it can be. Optional; with
 * neither, the card shows no minimum.
 */
export function MinDueFields({
  pct,
  floor,
  onChangePct,
  onChangeFloor,
}: {
  pct: string;
  floor: string;
  onChangePct: (v: string) => void;
  onChangeFloor: (v: string) => void;
}) {
  return (
    <View>
      <View style={styles.row}>
        <View style={styles.half}>
          <AmountField
            label="Minimum due (%)"
            value={pct}
            onChangeText={onChangePct}
            placeholder="e.g. 5"
            maxLength={5}
          />
        </View>
        <View style={styles.half}>
          <AmountField label="At least" value={floor} onChangeText={onChangeFloor} placeholder="e.g. 200" />
        </View>
      </View>
      <Text style={styles.hint}>
        From your card's terms. Shown on the bill as the least to pay. Leave empty to skip.
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
