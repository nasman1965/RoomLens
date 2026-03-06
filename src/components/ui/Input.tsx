import React from 'react';
import { View, Text, TextInput, StyleSheet, TextInputProps, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Radius, FontSize, Spacing } from '../../constants/theme';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  icon?: string;
  containerStyle?: ViewStyle;
  hint?: string;
}

export default function Input({
  label, error, icon, containerStyle, hint, ...props
}: InputProps) {
  return (
    <View style={[styles.container, containerStyle]}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View style={[styles.inputRow, error ? styles.inputError : null]}>
        {icon ? (
          <Ionicons name={icon as any} size={18} color={Colors.textMuted} style={styles.icon} />
        ) : null}
        <TextInput
          style={[styles.input, !icon && { paddingLeft: 14 }]}
          placeholderTextColor={Colors.textMuted}
          autoCorrect={false}
          {...props}
        />
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {hint && !error ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: Spacing.sm },
  label: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginBottom: 6,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.inputBg,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    minHeight: 52,
    paddingRight: 12,
  },
  inputError: { borderColor: Colors.error },
  icon: { marginLeft: 12, marginRight: 6 },
  input: {
    flex: 1,
    fontSize: FontSize.md,
    color: Colors.textPrimary,
    paddingVertical: 12,
  },
  error: {
    fontSize: FontSize.xs,
    color: Colors.error,
    marginTop: 4,
    marginLeft: 2,
  },
  hint: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    marginTop: 4,
    marginLeft: 2,
  },
});
