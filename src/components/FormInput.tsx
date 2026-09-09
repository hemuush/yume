import { forwardRef } from 'react';
import { View, Text, TextInput, StyleSheet, TextInputProps } from 'react-native';
import { theme } from '@/constants/theme';

interface Props extends TextInputProps {
  label: string;
}

export const FormInput = forwardRef<TextInput, Props>(function FormInput({ label, style, ...rest }, ref) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        ref={ref}
        style={[styles.input, style]}
        placeholderTextColor={theme.colors.textMuted}
        {...rest}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: { marginBottom: 14 },
  label: {
    fontSize: 13,
    fontFamily: theme.font.bodyBold,
    color: theme.colors.textSecondary,
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: theme.colors.textPrimary,
    backgroundColor: theme.colors.surface,
  },
});
