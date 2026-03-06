import React from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, StatusBar, ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useJobsStore } from '../../src/store';
import { Colors, FontSize, Spacing, Radius, Shadow } from '../../src/constants/theme';

export default function FloorPlanTab() {
  const router = useRouter();
  const { jobs } = useJobsStore();

  // Active jobs that don't yet have a floor plan
  const activeJobs = jobs.filter((j) => j.status === 'active' || j.status === 'draft');

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* Header */}
      <LinearGradient colors={[Colors.navy, Colors.navyLight]} style={styles.header}>
        <Text style={styles.headerTitle}>360° Floor Plan</Text>
        <Text style={styles.headerSub}>Capture · Process · Deliver</Text>
      </LinearGradient>

      <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent} showsVerticalScrollIndicator={false}>

        {/* How it works */}
        <View style={styles.stepsCard}>
          <Text style={styles.stepsTitle}>How It Works</Text>
          {[
            { step: '1', icon: 'wifi-outline',          color: Colors.tileFloorplan, text: 'Connect to Insta360 X4 or Ricoh Theta via Wi-Fi' },
            { step: '2', icon: 'camera-outline',         color: Colors.success,       text: 'Capture one 360° photo per room at 1.2 m height' },
            { step: '3', icon: 'sparkles-outline',       color: Colors.tileEstimate,  text: 'AI processes photos → dimensioned SVG floor plan' },
            { step: '4', icon: 'document-outline',       color: Colors.tileMoisture,  text: 'Download PDF + share with client or import to Xactimate' },
          ].map(({ step, icon, color, text }) => (
            <View key={step} style={styles.stepRow}>
              <View style={[styles.stepNum, { backgroundColor: color }]}>
                <Text style={styles.stepNumText}>{step}</Text>
              </View>
              <Ionicons name={icon as any} size={18} color={color} style={styles.stepIcon} />
              <Text style={styles.stepText}>{text}</Text>
            </View>
          ))}
        </View>

        {/* Active jobs — quick-launch */}
        {activeJobs.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Open a Job to Scan</Text>
            {activeJobs.slice(0, 5).map((job) => (
              <TouchableOpacity
                key={job.id}
                style={styles.jobRow}
                onPress={() => router.push(`/floorplan/${job.id}` as any)}
                activeOpacity={0.85}
              >
                <View style={styles.jobIcon}>
                  <Ionicons name="scan-outline" size={20} color={Colors.tileFloorplan} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.jobAddress} numberOfLines={1}>{job.property_address}</Text>
                  <Text style={styles.jobStatus}>{job.status} · tap to scan</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
              </TouchableOpacity>
            ))}
          </View>
        ) : (
          <View style={styles.emptyBox}>
            <Ionicons name="folder-open-outline" size={44} color={Colors.textMuted} />
            <Text style={styles.emptyTitle}>No active jobs</Text>
            <Text style={styles.emptyText}>Create a job first, then return here to start scanning</Text>
          </View>
        )}

        {/* CTA */}
        <TouchableOpacity
          style={styles.newJobBtn}
          onPress={() => router.push('/job/new')}
          activeOpacity={0.9}
        >
          <LinearGradient
            colors={[Colors.red, Colors.redDark]}
            style={styles.newJobGradient}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
          >
            <Ionicons name="add-circle-outline" size={22} color="#fff" />
            <Text style={styles.newJobText}>New Job → Start Floor Plan</Text>
            <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.7)" style={{ marginLeft: 'auto' }} />
          </LinearGradient>
        </TouchableOpacity>

        {/* Camera tip */}
        <View style={styles.tipCard}>
          <Ionicons name="information-circle-outline" size={18} color={Colors.info} />
          <Text style={styles.tipText}>
            <Text style={{ fontWeight: '700' }}>Camera tip: </Text>
            Insta360 X4 Wi-Fi password is <Text style={{ fontFamily: 'monospace', fontWeight: '700' }}>88888888</Text>.
            Connect your phone to the camera's hotspot before tapping scan.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    paddingTop: 56, paddingBottom: 24, paddingHorizontal: Spacing.md,
    alignItems: 'center',
  },
  headerTitle: { fontSize: FontSize.xxl, fontWeight: '800', color: '#fff', letterSpacing: 0.5 },
  headerSub: { fontSize: FontSize.xs, color: 'rgba(255,255,255,0.6)', marginTop: 4, letterSpacing: 1.5, textTransform: 'uppercase' },

  body: { flex: 1 },
  bodyContent: { padding: Spacing.md, paddingBottom: 40 },

  stepsCard: {
    backgroundColor: Colors.card, borderRadius: Radius.lg, padding: Spacing.md,
    marginBottom: Spacing.lg, ...Shadow.sm,
  },
  stepsTitle: {
    fontSize: FontSize.sm, fontWeight: '700', color: Colors.textPrimary,
    marginBottom: Spacing.md, textTransform: 'uppercase', letterSpacing: 0.5,
  },
  stepRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14,
  },
  stepNum: {
    width: 22, height: 22, borderRadius: 6,
    justifyContent: 'center', alignItems: 'center',
  },
  stepNumText: { fontSize: 11, fontWeight: '800', color: '#fff' },
  stepIcon: { width: 22 },
  stepText: { flex: 1, fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 18 },

  section: { marginBottom: Spacing.lg },
  sectionTitle: {
    fontSize: FontSize.xs, fontWeight: '700', color: Colors.textPrimary,
    textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: Spacing.sm,
  },
  jobRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: Colors.card, borderRadius: Radius.md,
    padding: Spacing.md, marginBottom: 8, ...Shadow.sm,
  },
  jobIcon: {
    width: 40, height: 40, borderRadius: 10,
    backgroundColor: `${Colors.tileFloorplan}15`,
    justifyContent: 'center', alignItems: 'center',
  },
  jobAddress: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.textPrimary },
  jobStatus: { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 2, textTransform: 'capitalize' },

  emptyBox: {
    alignItems: 'center', paddingVertical: Spacing.xl,
    backgroundColor: Colors.card, borderRadius: Radius.lg, marginBottom: Spacing.lg,
    ...Shadow.sm,
  },
  emptyTitle: { fontSize: FontSize.md, fontWeight: '700', color: Colors.textPrimary, marginTop: 12 },
  emptyText: { fontSize: FontSize.sm, color: Colors.textMuted, textAlign: 'center', marginTop: 6, paddingHorizontal: 24, lineHeight: 20 },

  newJobBtn: { borderRadius: Radius.lg, overflow: 'hidden', marginBottom: Spacing.md, ...Shadow.md },
  newJobGradient: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: Spacing.md, paddingVertical: 18,
  },
  newJobText: { fontSize: FontSize.md, fontWeight: '800', color: '#fff' },

  tipCard: {
    backgroundColor: '#eff6ff', borderRadius: Radius.md, padding: Spacing.md,
    flexDirection: 'row', gap: 10, alignItems: 'flex-start',
  },
  tipText: { flex: 1, fontSize: FontSize.xs, color: Colors.textSecondary, lineHeight: 18 },
});
