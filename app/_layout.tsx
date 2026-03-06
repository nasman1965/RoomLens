import React, { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { authService } from '../src/services/auth';
import { useAuthStore } from '../src/store';

export default function RootLayout() {
  const { setUser, setLoading } = useAuthStore();

  useEffect(() => {
    // Subscribe to Firebase auth state — fires immediately on app start
    // with the persisted session (if any) thanks to AsyncStorage persistence.
    const unsubscribe = authService.onAuthStateChange((user) => {
      setUser(user);
      setLoading(false);
    });

    return () => unsubscribe();
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
