import { forwardRef, useState } from 'react';
import { View, StyleSheet, TextInputProps, type TextInputInstance } from 'react-native';
import { Text, TextInput } from '@/components/Text';
import { theme } from '@/constants/theme';
import { useSheetSurface } from './SheetSurface';
import { FIELD_LABEL } from '@/constants/textStyles';

import { useAccent } from '@/theme/AccentContext';
import { interactionColors } from '@/theme/interactionColors';

interface Props extends TextInputProps {
  label: string;
}

export const FormInput = forwardRef<TextInputInstance, Props>(function FormInput(
  { label, style, onFocus, onBlur, ...rest },
  ref
) {
  const inSheet = useSheetSurface();
  const { accent } = useAccent();
  const colors = interactionColors(accent);
  const [focused, setFocused] = useState(false);
  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        ref={ref}
        accessibilityLabel={label}
        style={[
          styles.input,
          inSheet && styles.sheetInput,
          focused && [styles.inputFocused, { borderColor: colors.ink }],
          style,
        ]}
        selectionColor={colors.edge}
        cursorColor={colors.ink}
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
    backgroundColor: theme.colors.surface,
  },
});
