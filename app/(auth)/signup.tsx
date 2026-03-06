import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, StatusBar,
  KeyboardAvoidingView, Platform, TouchableOpacity,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Input from '../../src/components/ui/Input';
import Button from '../../src/components/ui/Button';
import { authService } from '../../src/services/auth';
import { useAuthStore } from '../../src/store';
import { Colors, FontSize, Spacing, Radius, Shadow } from '../../src/constants/theme';

export default function SignupScreen() {
  const router = useRouter();
  const { setUser, setSession } = useAuthStore();

  const [companyName, setCompanyName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{
    company?: string; email?: string; password?: string; confirm?: string; general?: string;
  }>({});

  const validate = () => {
    const e: typeof errors = {};
    if (!companyName.trim()) e.company = 'Company name is required';
    if (!email.trim()) e.email = 'Email is required';
    else if (!/\S+@\S+\.\S+/.test(email)) e.email = 'Enter a valid email';
    if (!password) e.password = 'Password is required';
    else if (password.length < 8) e.password = 'Minimum 8 characters';
    if (!confirm) e.confirm = 'Please confirm your password';
    else if (confirm !== password) e.confirm = 'Passwords do not match';
    setErrors(e);
    return !Object.keys(e).length;
  };

  const handleSignup = async () => {
    if (!validate()) return;
    setLoading(true);
    const { user, error } = await authService.signUp(
      email.trim().toLowerCase(),
      password,
      companyName.trim()
    );
    setLoading(false);
    if (error) { setErrors({ general: error }); return; }
    if (user) {
      setUser(user);
      const session = await authService.getSession();
      setSession(session);
      router.replace('/(tabs)');
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <StatusBar barStyle="light-content" />
      <LinearGradient colors={[Colors.navy, Colors.navyLight]} style={styles.header}>
        <View style={styles.headerIcon}><Text style={{ fontSize: 36 }}>📐</Text></View>
        <Text style={styles.headerTitle}>Create Account</Text>
        <Text style={styles.headerSub}>Start your free trial — 3 jobs free</Text>
      </LinearGradient>

      <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          {errors.general ? (
            <View style={styles.errorBanner}>
              <Ionicons name="alert-circle-outline" size={16} color={Colors.error} />
              <Text style={styles.errorBannerText}>{errors.general}</Text>
            </View>
          ) : null}

          <Input
            label="Company Name"
            icon="business-outline"
            placeholder="Acme Restoration Inc."
            autoCapitalize="words"
            value={companyName}
            onChangeText={(t) => { setCompanyName(t); setErrors((e) => ({ ...e, company: undefined })); }}
            error={errors.company}
          />

          <Input
            label="Email Address"
            icon="mail-outline"
            placeholder="you@company.com"
            keyboardType="email-address"
            autoCapitalize="none"
            value={email}
            onChangeText={(t) => { setEmail(t); setErrors((e) => ({ ...e, email: undefined })); }}
            error={errors.email}
          />

          <View>
            <Input
              label="Password"
              icon="key-outline"
              placeholder="Min. 8 characters"
              secureTextEntry={!showPass}
              value={password}
              onChangeText={(t) => { setPassword(t); setErrors((e) => ({ ...e, password: undefined })); }}
              error={errors.password}
              hint="Must be at least 8 characters"
            />
            <TouchableOpacity onPress={() => setShowPass(!showPass)} style={styles.eyeBtn}>
              <Ionicons name={showPass ? 'eye-off-outline' : 'eye-outline'} size={18} color={Colors.textMuted} />
            </TouchableOpacity>
          </View>

          <View>
            <Input
              label="Confirm Password"
              icon="shield-checkmark-outline"
              placeholder="Re-enter password"
              secureTextEntry={!showConfirm}
              value={confirm}
              onChangeText={(t) => { setConfirm(t); setErrors((e) => ({ ...e, confirm: undefined })); }}
              error={errors.confirm}
            />
            <TouchableOpacity onPress={() => setShowConfirm(!showConfirm)} style={styles.eyeBtn}>
              <Ionicons name={showConfirm ? 'eye-off-outline' : 'eye-outline'} size={18} color={Colors.textMuted} />
            </TouchableOpacity>
          </View>

          <Button
            title="Create Account"
            onPress={handleSignup}
            loading={loading}
            icon="person-add-outline"
            iconPosition="right"
            size="lg"
            style={{ marginTop: Spacing.md }}
          />

          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>already have an account?</Text>
            <View style={styles.dividerLine} />
          </View>

          <Button
            title="Sign In Instead"
            onPress={() => router.replace('/(auth)/login')}
            variant="secondary"
            size="lg"
          />

          <Text style={styles.terms}>
            By creating an account you agree to our{' '}
            <Text style={styles.termsLink}>Terms of Service</Text>
            {' '}and{' '}
            <Text style={styles.termsLink}>Privacy Policy</Text>
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingTop: 70, paddingBottom: 36,
    alignItems: 'center',
    borderBottomLeftRadius: 28, borderBottomRightRadius: 28,
  },
  headerIcon: {
    width: 72, height: 72, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center', alignItems: 'center', marginBottom: 10,
  },
  headerTitle: { fontSize: FontSize.xxl, fontWeight: '800', color: '#fff', letterSpacing: 1 },
  headerSub: { color: 'rgba(255,255,255,0.65)', fontSize: FontSize.sm, marginTop: 4 },
  body: { flex: 1, backgroundColor: Colors.background },
  bodyContent: { padding: Spacing.md, paddingBottom: 60 },
  card: {
    backgroundColor: Colors.card, borderRadius: 20,
    padding: Spacing.lg, marginTop: 8,
    ...Shadow.md,
  },
  errorBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#fff0f1', borderRadius: Radius.sm,
    padding: 12, marginBottom: Spacing.md,
    borderLeftWidth: 3, borderLeftColor: Colors.error,
  },
  errorBannerText: { color: Colors.error, fontSize: FontSize.sm, flex: 1 },
  eyeBtn: { position: 'absolute', right: 14, top: 38 },
  divider: { flexDirection: 'row', alignItems: 'center', marginVertical: Spacing.md },
  dividerLine: { flex: 1, height: 1, backgroundColor: Colors.border },
  dividerText: { marginHorizontal: 10, color: Colors.textMuted, fontSize: FontSize.xs },
  terms: {
    textAlign: 'center', fontSize: FontSize.xs, color: Colors.textMuted,
    marginTop: Spacing.md, lineHeight: 18,
  },
  termsLink: { color: Colors.red, fontWeight: '600' },
});
