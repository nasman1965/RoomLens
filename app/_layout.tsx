import React, { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { authService } from '../src/services/auth';
import { useAuthStore } from '../src/store';

export default function RootLayout() {
  const { setUser, setSession, setLoading } = useAuthStore();

  useEffect(() => {
    // Initialise auth state on app launch
    const checkSession = async () => {
      try {
        const session = await authService.getSession();
        if (session) {
          const user = await authService.getCurrentUser();
          if (user) {
            setUser(user);
            setSession(session);
          }
        }
      } catch (_) {}
      setLoading(false);
    };
    checkSession();

    // Listen for auth changes
    const { data: { subscription } } = authService.onAuthStateChange(
      async (event, session) => {
        setSession(session);
        if (event === 'SIGNED_OUT') setUser(null);
      }
    );
    return () => subscription.unsubscribe();
  }, []);

  return (
    <>
      <StatusBar style="auto" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="job/new" options={{ presentation: 'modal' }} />
        <Stack.Screen name="job/[id]" />
        <Stack.Screen name="floorplan/[jobId]" />
        <Stack.Screen name="moisture/[jobId]" />
        <Stack.Screen name="photos/[jobId]" />
        <Stack.Screen name="estimate/[jobId]" />
        <Stack.Screen name="settings" options={{ presentation: 'modal' }} />
      </Stack>
    </>
  );
}
