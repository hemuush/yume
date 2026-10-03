import { View } from 'react-native';
import { Text } from '@/components/Text';
import { styles } from './hero.styles';

export function WorkingRow({
  label,
  value,
  total = false,
  due = false,
}: {
  label: string;
  value: string;
  total?: boolean;
  due?: boolean;
}) {
  return (
    <View style={[styles.workingRow, total && styles.workingTotal]}>
      <Text style={[styles.workingLabel, total && styles.workingLabelTotal]}>{label}</Text>
      <Text style={[styles.workingValue, due && styles.workingValueDue]}>{value}</Text>
    </View>
  );
}
