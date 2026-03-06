import React from 'react';
import {
  View, Text, StyleSheet, ScrollView, StatusBar,
  TouchableOpacity, Alert, Platform, Linking,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontSize, Spacing, Radius, Shadow } from '../src/constants/theme';
import { useAuthStore } from '../src/store';
import { SUBSCRIPTION_TIERS } from '../src/constants/app';

interface SettingRow {
  icon: string;
  label: string;
  value?: string;
  onPress?: () => void;
  destructive?: boolean;
  badge?: string;
}

function SettingsSection({ title, rows }: { title: string; rows: SettingRow[] }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={[styles.sectionCard, Shadow.sm]}>
        {rows.map((row, i) => (
          <TouchableOpacity
            key={row.label}
            style={[styles.row, i < rows.length - 1 && styles.rowBorder]}
            onPress={row.onPress}
            disabled={!row.onPress}
            activeOpacity={row.onPress ? 0.7 : 1}
          >
            <View style={[styles.rowIcon, row.destructive && { backgroundColor: '#fff0f1' }]}>
              <Ionicons name={row.icon as any} size={18} color={row.destructive ? Colors.error : Colors.navy} />
            </View>
            <Text style={[styles.rowLabel, row.destructive && { color: Colors.error }]}>{row.label}</Text>
            {row.badge ? (
              <View style={styles.badge}><Text style={styles.badgeText}>{row.badge}</Text></View>
            ) : null}
            {row.value ? <Text style={styles.rowValue}>{row.value}</Text> : null}
            {row.onPress && !row.destructive ? (
              <Ionicons name="chevron-forward" size={15} color={Colors.textMuted} />
            ) : null}
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

export default function SettingsScreen() {
  const router = useRouter();
  const { user, signOut } = useAuthStore();

  const tier = (user?.subscription_tier ?? 'free') as keyof typeof SUBSCRIPTION_TIERS;
  const tierInfo = SUBSCRIPTION_TIERS[tier];

  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: async () => {
        await signOut();
        router.replace('/(auth)/login');
      }},
    ]);
  };

  const handleUpgrade = () => {
    Alert.alert(
      'Upgrade Plan',
      'Pricing:\n\n🆓 Free — 3 jobs/mo\n💼 Starter — $99 CAD/mo · 20 jobs\n🚀 Pro — $199 CAD/mo · Unlimited\n🏢 Enterprise — Custom',
      [{ text: 'Contact Us', onPress: () => Linking.openURL('mailto:hello@roomlenspro.ca') }, { text: 'Close' }]
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.closeBtn}>
          <Ionicons name="close" size={22} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Settings</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>

        {/* Profile card */}
        <View style={[styles.profileCard, Shadow.md]}>
          <View style={styles.profileAvatar}>
            <Text style={styles.profileInitials}>
              {user?.company_name?.slice(0, 2).toUpperCase() ?? 'RL'}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.profileName}>{user?.company_name ?? 'Your Company'}</Text>
            <Text style={styles.profileEmail}>{user?.email ?? ''}</Text>
          </View>
          <View style={[styles.tierBadge, tier === 'free' && { backgroundColor: '#f0f4f8' }]}>
            <Text style={[styles.tierBadgeText, tier === 'free' && { color: Colors.textMuted }]}>
              {tierInfo.label.toUpperCase()}
            </Text>
          </View>
        </View>

        {/* Subscription */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Subscription</Text>
          <View style={[styles.subCard, Shadow.sm]}>
            <View style={styles.subRow}>
              <View>
                <Text style={styles.subPlan}>{tierInfo.label} Plan</Text>
                <Text style={styles.subDetail}>
                  {tierInfo.jobsPerMonth === -1
                    ? 'Unlimited jobs/month'
                    : `${tierInfo.jobsPerMonth} jobs/month`}
                  {tierInfo.allModules ? ' · All modules' : ' · Floor plan only'}
                </Text>
              </View>
              {tier === 'free' || tier === 'starter' ? (
                <TouchableOpacity style={styles.upgradeBtn} onPress={handleUpgrade}>
                  <Text style={styles.upgradeBtnText}>Upgrade</Text>
                </TouchableOpacity>
              ) : (
                <View style={[styles.tierBadge, { backgroundColor: `${Colors.gold}20` }]}>
                  <Ionicons name="star" size={12} color={Colors.gold} />
                  <Text style={[styles.tierBadgeText, { color: Colors.gold }]}>ACTIVE</Text>
                </View>
              )}
            </View>
          </View>
        </View>

        <SettingsSection
          title="Account"
          rows={[
            { icon: 'business-outline',        label: 'Company Name',   value: user?.company_name ?? '', },
            { icon: 'mail-outline',             label: 'Email Address',  value: user?.email ?? '', },
            { icon: 'lock-closed-outline',      label: 'Change Password', onPress: () => router.push('/(auth)/forgot-password') },
          ]}
        />

        <SettingsSection
          title="Camera"
          rows={[
            { icon: 'radio-outline',           label: 'Default Camera', value: 'Insta360 X4', onPress: () => {} },
            { icon: 'wifi-outline',            label: 'Camera IP Address', value: '192.168.42.1', },
          ]}
        />

        <SettingsSection
          title="App"
          rows={[
            { icon: 'notifications-outline',   label: 'Notifications',  onPress: () => {} },
            { icon: 'cloud-upload-outline',    label: 'Data & Storage',  onPress: () => {} },
            { icon: 'help-circle-outline',     label: 'Help & Support',  onPress: () => Linking.openURL('mailto:hello@roomlenspro.ca') },
            { icon: 'document-text-outline',   label: 'Privacy Policy',  onPress: () => {} },
          ]}
        />

        <SettingsSection
          title="Danger Zone"
          rows={[
            {
              icon: 'log-out-outline',
              label: 'Sign Out',
              onPress: handleSignOut,
              destructive: true,
            },
          ]}
        />

        <Text style={styles.version}>RoomLensPro v1.0.0 · Built for restoration pros</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    paddingTop: Platform.OS === 'ios' ? 56 : 36,
    paddingHorizontal: Spacing.md, paddingBottom: Spacing.sm,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: Colors.card, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  closeBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: Colors.background, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: FontSize.lg, fontWeight: '800', color: Colors.textPrimary },
  body: { flex: 1 },
  bodyContent: { padding: Spacing.md, paddingBottom: 60 },

  profileCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: Colors.card, borderRadius: Radius.lg,
    padding: Spacing.md, marginBottom: Spacing.lg,
  },
  profileAvatar: {
    width: 52, height: 52, borderRadius: 16,
    backgroundColor: Colors.navy,
    justifyContent: 'center', alignItems: 'center',
  },
  profileInitials: { fontSize: FontSize.lg, fontWeight: '800', color: '#fff' },
  profileName: { fontSize: FontSize.md, fontWeight: '700', color: Colors.textPrimary },
  profileEmail: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 2 },
  tierBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: `${Colors.red}18`, borderRadius: Radius.full,
    paddingHorizontal: 10, paddingVertical: 5,
  },
  tierBadgeText: { fontSize: 10, fontWeight: '800', color: Colors.red, letterSpacing: 0.5 },

  subCard: {
    backgroundColor: Colors.card, borderRadius: Radius.md,
    padding: Spacing.md,
  },
  subRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  subPlan: { fontSize: FontSize.md, fontWeight: '700', color: Colors.textPrimary },
  subDetail: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 3 },
  upgradeBtn: {
    backgroundColor: Colors.red, borderRadius: Radius.md,
    paddingHorizontal: 14, paddingVertical: 8,
  },
  upgradeBtnText: { fontSize: FontSize.sm, fontWeight: '700', color: '#fff' },

  section: { marginBottom: Spacing.md },
  sectionTitle: {
    fontSize: FontSize.xs, fontWeight: '700', color: Colors.textMuted,
    textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8, marginLeft: 4,
  },
  sectionCard: { backgroundColor: Colors.card, borderRadius: Radius.md, overflow: 'hidden' },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: Spacing.md, paddingVertical: 14,
  },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: Colors.border },
  rowIcon: {
    width: 32, height: 32, borderRadius: 8,
    backgroundColor: `${Colors.navy}12`,
    justifyContent: 'center', alignItems: 'center',
  },
  rowLabel: { flex: 1, fontSize: FontSize.sm, fontWeight: '500', color: Colors.textPrimary },
  rowValue: { fontSize: FontSize.xs, color: Colors.textMuted, maxWidth: 120, textAlign: 'right' },
  badge: {
    backgroundColor: Colors.red, borderRadius: Radius.full,
    paddingHorizontal: 7, paddingVertical: 2, marginRight: 4,
  },
  badgeText: { fontSize: 10, fontWeight: '700', color: '#fff' },
  version: {
    textAlign: 'center', fontSize: FontSize.xs, color: Colors.textMuted,
    marginTop: Spacing.sm,
  },
});
