import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../src/constants/theme';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: Colors.red,
        tabBarInactiveTintColor: Colors.textMuted,
        tabBarStyle: {
          backgroundColor: Colors.card,
          borderTopColor: Colors.border,
          borderTopWidth: 1,
          paddingBottom: 6,
          paddingTop: 4,
          height: 60,
        },
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '600',
          marginTop: 2,
        },
      }}
    >
      {/* Tab 1 — Home / Dashboard */}
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home-outline" size={size} color={color} />
          ),
        }}
      />

      {/* Tab 2 — Floor Plan (360° capture module) */}
      <Tabs.Screen
        name="floor-plan"
        options={{
          title: 'Floor Plan',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="scan-outline" size={size} color={color} />
          ),
        }}
      />

      {/* Tab 3 — Moisture Map */}
      <Tabs.Screen
        name="moisture-map"
        options={{
          title: 'Moisture',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="water-outline" size={size} color={color} />
          ),
        }}
      />

      {/* Tab 4 — Large Loss rapid photo mode */}
      <Tabs.Screen
        name="large-loss"
        options={{
          title: 'Large Loss',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="business-outline" size={size} color={color} />
          ),
        }}
      />

      {/* Hidden tabs — accessible via deep-link / job dashboard tiles only */}
      <Tabs.Screen
        name="jobs"
        options={{
          href: null,   // hides from tab bar, keeps route accessible
        }}
      />
    </Tabs>
  );
}
