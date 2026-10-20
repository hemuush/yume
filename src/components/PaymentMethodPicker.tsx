import { ScrollView, View, StyleSheet } from 'react-native';
import { Text } from './Text';
import { Chip } from './Chip';
import { PAYMENT_METHODS } from '@/lib/paymentMode';
import type { PaymentMode } from '@/types';
import { theme } from '@/constants/theme';

export function PaymentMethodPicker({
  value,
  onChange,
  filter = false,
}: {
  value: PaymentMode | 'all' | 'unspecified';
  onChange: (value: PaymentMode | 'all' | 'unspecified') => void;
  filter?: boolean;
}) {
  const choices = [
    ...(filter ? [{ value: 'all' as const, label: 'Any method' }] : []),
    { value: 'unspecified' as const, label: 'Not recorded' },
    ...PAYMENT_METHODS,
  ];
  return (
    <View style={s.wrap}>
      <Text style={s.label}>Payment method</Text>
      <ScrollView
        horizontal
        keyboardShouldPersistTaps="handled"
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.row}
      >
        {choices.map((method) => (
          <Chip
            key={method.value}
            label={method.label}
            active={value === method.value}
            onPress={() => onChange(method.value)}
          />
        ))}
      </ScrollView>
    </View>
  );
}
const s = StyleSheet.create({
  wrap: { gap: 8, marginVertical: 10 },
  row: { gap: 8, paddingVertical: 3, paddingRight: 12 },
  label: { fontFamily: theme.font.bodyMedium, fontSize: 12, color: theme.colors.textSecondary },
});
