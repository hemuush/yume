import { forwardRef, useState } from 'react';
import { View, StyleSheet, TextInputProps, type TextInput as RNTextInput } from 'react-native';
import { Text, TextInput } from '@/components/Text';
import { theme } from '@/constants/theme';
import { useSheetSurface } from './SheetSurface';
import { FIELD_LABEL } from '@/constants/textStyles';

interface Props extends TextInputProps {
  label: string;
}

export const FormInput = forwardRef<RNTextInput, Props>(function FormInput(
  { label, style, onFocus, onBlur, ...rest },
  ref
) {
  const inSheet = useSheetSurface();
  const [focused, setFocused] = useState(false);
  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        ref={ref}
        accessibilityLabel={label}
        style={[styles.input, inSheet && styles.sheetInput, focused && styles.inputFocused, style]}
        placeholderTextColor={theme.colors.textMuted}
        onFocus={(e) => {
          setFocused(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          onBlur?.(e);
        }}
        {...rest}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: { marginBottom: 12 },
  label: { ...FIELD_LABEL, marginBottom: 6 },
  input: {
    // A transparent border by default so the focus ring can appear without
    // shifting the field's height.
    borderWidth: 1.5,
    borderColor: theme.colors.borderSoft,
    borderRadius: theme.radius.lg,
    paddingHorizontal: 14,
    paddingVertical: 10,
    minHeight: 48,
    fontSize: 13,
    fontFamily: theme.font.body,
    color: theme.colors.textPrimary,
    backgroundColor: theme.colors.surfaceAlt,
  },
  sheetInput: { backgroundColor: theme.colors.surface, borderRadius: 18, minHeight: 52 },
  inputFocused: {
    borderColor: theme.colors.link,
    backgroundColor: theme.colors.surface,
  },
});
