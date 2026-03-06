import React, { useEffect } from 'react';
import { View, Text, Image, StyleSheet, StatusBar } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Colors, FontSize, Spacing } from '../../src/constants/theme';
import { authService } from '../../src/services/auth';
import { useAuthStore } from '../../src/store';

export default function SplashScreen() {
  const router = useRouter();
  const { setUser, setSession, setLoading } = useAuthStore();

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const session = await authService.getSession();
        if (session) {
          const user = await authService.getCurrentUser();
          if (user) {
            setUser(user);
            setSession(session);
            setLoading(false);
            router.replace('/(tabs)');
            return;
          }
        }
      } catch {}
      setLoading(false);
      // Small delay for splash visual
      setTimeout(() => router.replace('/(auth)/login'), 1800);
    };
    checkAuth();
  }, []);

  return (
    <LinearGradient colors={[Colors.navy, Colors.navyLight, '#2d5986']} style={styles.container}>
      <StatusBar barStyle="light-content" />
      <View style={styles.content}>
        <View style={styles.logoBox}>
          <Text style={styles.logoIcon}>📐</Text>
        </View>
        <Text style={styles.brand}>RoomLensPro</Text>
        <Text style={styles.tagline}>Document once. Deliver everything.</Text>
      </View>
      <Text style={styles.footer}>Professional Restoration Documentation</Text>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  logoBox: {
    width: 100, height: 100, borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center', alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  logoIcon: { fontSize: 52 },
  brand: {
    fontSize: FontSize.hero,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: 1,
    marginBottom: Spacing.xs,
  },
  tagline: {
    fontSize: FontSize.sm,
    color: 'rgba(255,255,255,0.65)',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  footer: {
    textAlign: 'center',
    color: 'rgba(255,255,255,0.4)',
    fontSize: FontSize.xs,
    paddingBottom: 40,
    letterSpacing: 0.5,
  },
});
