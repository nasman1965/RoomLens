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

export default function LoginScreen() {
  const router = useRouter();
  const { setUser, setSession } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string; general?: string }>({});

  const validate = () => {
    const e: typeof errors = {};
    if (!email.trim()) e.email = 'Email is required';
    else if (!/\S+@\S+\.\S+/.test(email)) e.email = 'Enter a valid email';
    if (!password) e.password = 'Password is required';
    setErrors(e);
    return !Object.keys(e).length;
  };

  const handleLogin = async () => {
    if (!validate()) return;
    setLoading(true);
    const { user, error } = await authService.signIn(email.trim().toLowerCase(), password);
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
        <View style={styles.headerIcon}>
          <Text style={{ fontSize: 36 }}>📐</Text>
        </View>
        <Text style={styles.headerTitle}>RoomLensPro</Text>
        <Text style={styles.headerSub}>Sign in to your account</Text>
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
            label="Email Address"
            icon="mail-outline"
            placeholder="you@company.com"
            keyboardType="email-address"
            autoCapitalize="none"
            value={email}
            onChangeText={(t) => { setEmail(t); setErrors((e) => ({ ...e, email: undefined, general: undefined })); }}
            error={errors.email}
          />

          <View>
            <Input
              label="Password"
              icon="key-outline"
              placeholder="••••••••"
              secureTextEntry={!showPass}
              value={password}
              onChangeText={(t) => { setPassword(t); setErrors((e) => ({ ...e, password: undefined, general: undefined })); }}
              error={errors.password}
            />
            <TouchableOpacity onPress={() => setShowPass(!showPass)} style={styles.eyeBtn}>
              <Ionicons name={showPass ? 'eye-off-outline' : 'eye-outline'} size={18} color={Colors.textMuted} />
            </TouchableOpacity>
          </View>

          <TouchableOpacity onPress={() => router.push('/(auth)/forgot-password')} style={styles.forgotBtn}>
            <Text style={styles.forgotText}>Forgot password?</Text>
          </TouchableOpacity>

          <Button title="Sign In" onPress={handleLogin} loading={loading} icon="log-in-outline" iconPosition="right" size="lg" style={{ marginTop: Spacing.lg }} />

          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or</Text>
            <View style={styles.dividerLine} />
          </View>

          <Button
            title="Create Account"
            onPress={() => router.push('/(auth)/signup')}
            variant="secondary"
            size="lg"
          />
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
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 10,
  },
  headerTitle: { fontSize: FontSize.xxl, fontWeight: '800', color: '#fff', letterSpacing: 1 },
  headerSub: { color: 'rgba(255,255,255,0.65)', fontSize: FontSize.sm, marginTop: 4 },
  body: { flex: 1, backgroundColor: Colors.background },
  bodyContent: { padding: Spacing.md, paddingBottom: 40 },
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
  forgotBtn: { alignSelf: 'flex-end', marginTop: 6, marginBottom: 4 },
  forgotText: { color: Colors.red, fontSize: FontSize.sm, fontWeight: '500' },
  divider: { flexDirection: 'row', alignItems: 'center', marginVertical: Spacing.md },
  dividerLine: { flex: 1, height: 1, backgroundColor: Colors.border },
  dividerText: { marginHorizontal: 12, color: Colors.textMuted, fontSize: FontSize.sm },
});
