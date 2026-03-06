import React, { useState } from 'react';
import {
  View, Text, StyleSheet, StatusBar,
  KeyboardAvoidingView, Platform, TouchableOpacity,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Input from '../../src/components/ui/Input';
import Button from '../../src/components/ui/Button';
import { authService } from '../../src/services/auth';
import { Colors, FontSize, Spacing, Radius, Shadow } from '../../src/constants/theme';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; general?: string }>({});

  const handleReset = async () => {
    if (!email.trim()) { setErrors({ email: 'Email is required' }); return; }
    if (!/\S+@\S+\.\S+/.test(email)) { setErrors({ email: 'Enter a valid email' }); return; }

    setLoading(true);
    const { error } = await authService.resetPassword(email.trim().toLowerCase());
    setLoading(false);

    if (error) { setErrors({ general: error }); return; }
    setSent(true);
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <StatusBar barStyle="light-content" />
      <LinearGradient colors={[Colors.navy, Colors.navyLight]} style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={22} color="#fff" />
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>
        <View style={styles.headerIcon}><Text style={{ fontSize: 36 }}>🔑</Text></View>
        <Text style={styles.headerTitle}>Reset Password</Text>
        <Text style={styles.headerSub}>We'll email you a reset link</Text>
      </LinearGradient>

      <View style={styles.body}>
        {sent ? (
          <View style={styles.card}>
            <View style={styles.successBox}>
              <Ionicons name="checkmark-circle" size={48} color={Colors.success} />
              <Text style={styles.successTitle}>Email Sent!</Text>
              <Text style={styles.successText}>
                Check your inbox at <Text style={{ fontWeight: '700' }}>{email}</Text> for the reset link.
              </Text>
            </View>
            <Button
              title="Back to Sign In"
              onPress={() => router.replace('/(auth)/login')}
              icon="log-in-outline"
              size="lg"
            />
          </View>
        ) : (
          <View style={styles.card}>
            {errors.general ? (
              <View style={styles.errorBanner}>
                <Ionicons name="alert-circle-outline" size={16} color={Colors.error} />
                <Text style={styles.errorBannerText}>{errors.general}</Text>
              </View>
            ) : null}

            <Text style={styles.instruction}>
              Enter the email address associated with your account and we'll send you a password reset link.
            </Text>

            <Input
              label="Email Address"
              icon="mail-outline"
              placeholder="you@company.com"
              keyboardType="email-address"
              autoCapitalize="none"
              value={email}
              onChangeText={(t) => { setEmail(t); setErrors({}); }}
              error={errors.email}
            />

            <Button
              title="Send Reset Link"
              onPress={handleReset}
              loading={loading}
              icon="send-outline"
              iconPosition="right"
              size="lg"
              style={{ marginTop: Spacing.md }}
            />

            <TouchableOpacity onPress={() => router.back()} style={styles.cancelBtn}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingTop: 60, paddingBottom: 36,
    alignItems: 'center',
    borderBottomLeftRadius: 28, borderBottomRightRadius: 28,
  },
  backBtn: {
    position: 'absolute', top: 56, left: 20,
    flexDirection: 'row', alignItems: 'center',
  },
  backText: { color: '#fff', fontSize: FontSize.sm, marginLeft: 2 },
  headerIcon: {
    width: 72, height: 72, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center', alignItems: 'center', marginBottom: 10,
  },
  headerTitle: { fontSize: FontSize.xxl, fontWeight: '800', color: '#fff', letterSpacing: 1 },
  headerSub: { color: 'rgba(255,255,255,0.65)', fontSize: FontSize.sm, marginTop: 4 },
  body: { flex: 1, backgroundColor: Colors.background, padding: Spacing.md, paddingTop: Spacing.lg },
  card: {
    backgroundColor: Colors.card, borderRadius: 20,
    padding: Spacing.lg,
    ...Shadow.md,
  },
  errorBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#fff0f1', borderRadius: 8,
    padding: 12, marginBottom: Spacing.md,
    borderLeftWidth: 3, borderLeftColor: Colors.error,
  },
  errorBannerText: { color: Colors.error, fontSize: FontSize.sm, flex: 1 },
  instruction: {
    color: Colors.textSecondary, fontSize: FontSize.sm,
    lineHeight: 20, marginBottom: Spacing.md,
  },
  successBox: { alignItems: 'center', marginBottom: Spacing.lg },
  successTitle: {
    fontSize: FontSize.xl, fontWeight: '700',
    color: Colors.textPrimary, marginTop: 12, marginBottom: 8,
  },
  successText: {
    color: Colors.textSecondary, fontSize: FontSize.sm,
    textAlign: 'center', lineHeight: 20,
  },
  cancelBtn: { alignItems: 'center', marginTop: Spacing.md, padding: 8 },
  cancelText: { color: Colors.textMuted, fontSize: FontSize.sm },
});
