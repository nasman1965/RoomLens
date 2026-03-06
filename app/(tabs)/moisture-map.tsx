import React from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, StatusBar, ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useJobsStore } from '../../src/store';
import { Colors, FontSize, Spacing, Radius, Shadow } from '../../src/constants/theme';
import { MOISTURE_THRESHOLDS, MATERIAL_LABELS, MaterialType } from '../../src/constants/app';

export default function MoistureMapTab() {
  const router = useRouter();
  const { jobs } = useJobsStore();

  const activeJobs = jobs.filter((j) => j.status === 'active' || j.status === 'draft');

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* Header */}
      <LinearGradient colors={[Colors.tileMoisture, '#0891b2']} style={styles.header}>
        <Text style={styles.headerTitle}>Moisture Map</Text>
        <Text style={styles.headerSub}>IICRC S500 · Day-by-Day Tracking</Text>
      </LinearGradient>

      <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent} showsVerticalScrollIndicator={false}>

        {/* Status legend */}
        <View style={styles.legendCard}>
          <Text style={styles.legendTitle}>Reading Status Guide</Text>
          <View style={styles.legendRow}>
            {[
              { color: Colors.moistureGreen,  label: 'Dry',     desc: 'Within normal range' },
              { color: Colors.moistureYellow, label: 'Caution', desc: 'Monitor closely' },
              { color: Colors.moistureRed,    label: 'Wet',     desc: 'Action required' },
            ].map(({ color, label, desc }) => (
              <View key={label} style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: color }]} />
                <Text style={styles.legendLabel}>{label}</Text>
                <Text style={styles.legendDesc}>{desc}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* IICRC thresholds quick-ref */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>IICRC S500 Thresholds</Text>
          <View style={styles.thresholdCard}>
            {(Object.entries(MOISTURE_THRESHOLDS) as [MaterialType, { green: number; yellow: number }][]).map(([mat, t]) => (
              <View key={mat} style={styles.thresholdRow}>
                <Text style={styles.thresholdMat}>{MATERIAL_LABELS[mat]}</Text>
                <View style={styles.thresholdValues}>
                  <Text style={[styles.tv, { color: Colors.moistureGreen }]}>{'<'}{t.green}%</Text>
                  <Text style={styles.tvSep}>·</Text>
                  <Text style={[styles.tv, { color: Colors.moistureYellow }]}>{t.green}–{t.yellow}%</Text>
                  <Text style={styles.tvSep}>·</Text>
                  <Text style={[styles.tv, { color: Colors.moistureRed }]}>{'>'}{t.yellow}%</Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* Active jobs quick-launch */}
        {activeJobs.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Open a Job to Map</Text>
            {activeJobs.slice(0, 5).map((job) => (
              <TouchableOpacity
                key={job.id}
                style={styles.jobRow}
                onPress={() => router.push(`/moisture/${job.id}` as any)}
                activeOpacity={0.85}
              >
                <View style={styles.jobIcon}>
                  <Ionicons name="water-outline" size={20} color={Colors.tileMoisture} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.jobAddress} numberOfLines={1}>{job.property_address}</Text>
                  <Text style={styles.jobStatus}>{job.status} · tap to map</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
              </TouchableOpacity>
            ))}
          </View>
        ) : (
          <View style={styles.emptyBox}>
            <Ionicons name="water-outline" size={44} color={Colors.textMuted} />
            <Text style={styles.emptyTitle}>No active jobs</Text>
            <Text style={styles.emptyText}>Create a job to start logging moisture readings</Text>
          </View>
        )}

        <TouchableOpacity
          style={styles.newJobBtn}
          onPress={() => router.push('/job/new')}
          activeOpacity={0.9}
        >
          <LinearGradient
            colors={[Colors.tileMoisture, '#0891b2']}
            style={styles.newJobGradient}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
          >
            <Ionicons name="add-circle-outline" size={22} color="#fff" />
            <Text style={styles.newJobText}>New Job → Start Moisture Map</Text>
            <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.7)" style={{ marginLeft: 'auto' }} />
          </LinearGradient>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    paddingTop: 56, paddingBottom: 24, paddingHorizontal: Spacing.md, alignItems: 'center',
  },
  headerTitle: { fontSize: FontSize.xxl, fontWeight: '800', color: '#fff', letterSpacing: 0.5 },
  headerSub: { fontSize: FontSize.xs, color: 'rgba(255,255,255,0.65)', marginTop: 4, letterSpacing: 1.2, textTransform: 'uppercase' },
  body: { flex: 1 },
  bodyContent: { padding: Spacing.md, paddingBottom: 40 },

  legendCard: {
    backgroundColor: Colors.card, borderRadius: Radius.lg, padding: Spacing.md,
    marginBottom: Spacing.lg, ...Shadow.sm,
  },
  legendTitle: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.textPrimary, marginBottom: 12 },
  legendRow: { flexDirection: 'row', justifyContent: 'space-between' },
  legendItem: { flex: 1, alignItems: 'center', gap: 4 },
  legendDot: { width: 28, height: 28, borderRadius: 14, marginBottom: 4 },
  legendLabel: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.textPrimary },
  legendDesc: { fontSize: FontSize.xs, color: Colors.textMuted, textAlign: 'center' },

  section: { marginBottom: Spacing.lg },
  sectionTitle: {
    fontSize: FontSize.xs, fontWeight: '700', color: Colors.textPrimary,
    textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: Spacing.sm,
  },
  thresholdCard: {
    backgroundColor: Colors.card, borderRadius: Radius.md, overflow: 'hidden', ...Shadow.sm,
  },
  thresholdRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.md, paddingVertical: 11,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  thresholdMat: { fontSize: FontSize.xs, color: Colors.textSecondary, fontWeight: '600', flex: 1 },
  thresholdValues: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  tv: { fontSize: FontSize.xs, fontWeight: '700' },
  tvSep: { fontSize: FontSize.xs, color: Colors.textMuted },

  jobRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: Colors.card, borderRadius: Radius.md,
    padding: Spacing.md, marginBottom: 8, ...Shadow.sm,
  },
  jobIcon: {
    width: 40, height: 40, borderRadius: 10,
    backgroundColor: `${Colors.tileMoisture}15`,
    justifyContent: 'center', alignItems: 'center',
  },
  jobAddress: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.textPrimary },
  jobStatus: { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 2, textTransform: 'capitalize' },

  emptyBox: {
    alignItems: 'center', paddingVertical: Spacing.xl,
    backgroundColor: Colors.card, borderRadius: Radius.lg, marginBottom: Spacing.lg, ...Shadow.sm,
  },
  emptyTitle: { fontSize: FontSize.md, fontWeight: '700', color: Colors.textPrimary, marginTop: 12 },
  emptyText: { fontSize: FontSize.sm, color: Colors.textMuted, textAlign: 'center', marginTop: 6, paddingHorizontal: 24, lineHeight: 20 },

  newJobBtn: { borderRadius: Radius.lg, overflow: 'hidden', ...Shadow.md },
  newJobGradient: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: Spacing.md, paddingVertical: 18,
  },
  newJobText: { fontSize: FontSize.md, fontWeight: '800', color: '#fff' },
});
