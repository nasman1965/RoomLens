import React from 'react';
import {
  TouchableOpacity, Text, ActivityIndicator,
  StyleSheet, ViewStyle, TextStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Radius, FontSize, Shadow } from '../../constants/theme';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  disabled?: boolean;
  icon?: string;
  iconPosition?: 'left' | 'right';
  style?: ViewStyle;
  fullWidth?: boolean;
}

export default function Button({
  title, onPress, variant = 'primary', size = 'md',
  loading = false, disabled = false, icon, iconPosition = 'left',
  style, fullWidth = true,
}: ButtonProps) {
  const isDisabled = disabled || loading;
  const pad = size === 'sm' ? 10 : size === 'lg' ? 18 : 14;
  const fontSize = size === 'sm' ? FontSize.sm : size === 'lg' ? FontSize.lg : FontSize.md;
  const iconSize = size === 'sm' ? 16 : size === 'lg' ? 22 : 18;

  const content = (
    <>
      {loading ? (
        <ActivityIndicator color={variant === 'secondary' || variant === 'ghost' ? Colors.navy : '#fff'} size="small" />
      ) : (
        <>
          {icon && iconPosition === 'left' && (
            <Ionicons name={icon as any} size={iconSize} color={variant === 'secondary' || variant === 'ghost' ? Colors.navy : '#fff'} style={{ marginRight: 6 }} />
          )}
          <Text style={[styles.text, { fontSize }, variant === 'secondary' || variant === 'ghost' ? { color: Colors.navy } : {}]}>
            {title}
          </Text>
          {icon && iconPosition === 'right' && (
            <Ionicons name={icon as any} size={iconSize} color={variant === 'secondary' || variant === 'ghost' ? Colors.navy : '#fff'} style={{ marginLeft: 6 }} />
          )}
        </>
      )}
    </>
  );

  if (variant === 'primary') {
    return (
      <TouchableOpacity
        onPress={onPress}
        disabled={isDisabled}
        activeOpacity={0.85}
        style={[styles.base, fullWidth && styles.fullWidth, isDisabled && styles.disabled, Shadow.md, style]}
      >
        <LinearGradient
          colors={isDisabled ? ['#94a3b8', '#94a3b8'] : [Colors.red, Colors.redDark]}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
          style={[styles.gradient, { paddingVertical: pad }]}
        >
          {content}
        </LinearGradient>
      </TouchableOpacity>
    );
  }

  const bgColor = variant === 'secondary' ? Colors.card
    : variant === 'danger' ? Colors.red
    : 'transparent';
  const borderColor = variant === 'secondary' ? Colors.border
    : variant === 'danger' ? Colors.red
    : 'transparent';

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.8}
      style={[
        styles.base, fullWidth && styles.fullWidth,
        { backgroundColor: bgColor, borderColor, borderWidth: 1.5, paddingVertical: pad },
        isDisabled && styles.disabled,
        variant === 'secondary' && Shadow.sm,
        style,
      ]}
    >
      <Text style={[styles.text, { fontSize }, variant === 'danger' && { color: '#fff' }]}>{title}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: Radius.md,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullWidth: { width: '100%' },
  gradient: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  text: {
    color: '#fff',
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  disabled: { opacity: 0.55 },
});
