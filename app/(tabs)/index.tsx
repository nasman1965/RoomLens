import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, StatusBar,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuthStore, useJobsStore } from '../../src/store';
import { jobsService } from '../../src/services/jobs';
import { Colors, FontSize, Spacing, Radius, Shadow } from '../../src/constants/theme';
import { Job } from '../../src/types';
import { JOB_TYPES } from '../../src/constants/app';

// ─── Status Badge ─────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: Job['status'] }) {
  const map: Record<Job['status'], { label: string; bg: string; color: string }> = {
    active:   { label: 'Active',    bg: '#e8fdf0', color: Colors.success },
    pending:  { label: 'Pending',   bg: '#fff8e1', color: Colors.warning },
    complete: { label: 'Complete',  bg: '#e8f0fe', color: Colors.info },
    draft:    { label: 'Draft',     bg: '#f0f4f8', color: Colors.textMuted },
  };
  const { label, bg, color } = map[status] ?? map.draft;
  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      <Text style={[styles.badgeText, { color }]}>{label}</Text>
    </View>
  );
}

// ─── Job Card ─────────────────────────────────────────────────────────────────
function JobCard({ job, onPress }: { job: Job; onPress: () => void }) {
  const jobTypeMeta = JOB_TYPES.find((t) => t.value === job.job_type);
  const date = new Date(job.created_at).toLocaleDateString('en-CA', {
    month: 'short', day: 'numeric',
  });

  return (
    <TouchableOpacity style={styles.jobCard} onPress={onPress} activeOpacity={0.85}>
      <View style={styles.jobCardLeft}>
        <View style={styles.jobIcon}>
          <Ionicons name={jobTypeMeta?.icon as any ?? 'construct-outline'} size={20} color={Colors.navy} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.jobAddress} numberOfLines={1}>{job.property_address}</Text>
          <Text style={styles.jobType}>{jobTypeMeta?.label ?? job.job_type}</Text>
          <Text style={styles.jobDate}>{date}</Text>
        </View>
      </View>
      <View style={styles.jobCardRight}>
        <StatusBadge status={job.status} />
        <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} style={{ marginTop: 8 }} />
      </View>
    </TouchableOpacity>
  );
}

// ─── Stat Card ────────────────────────────────────────────────────────────────
function StatCard({
  value, label, icon, color,
}: { value: number; label: string; icon: string; color: string }) {
  return (
    <View style={[styles.statCard, Shadow.sm]}>
      <View style={[styles.statIcon, { backgroundColor: `${color}20` }]}>
        <Ionicons name={icon as any} size={20} color={color} />
      </View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────
export default function DashboardScreen() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { jobs, setJobs, setLoading, loading } = useJobsStore();
  const [refreshing, setRefreshing] = useState(false);

  const loadJobs = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    const { jobs: fetched } = await jobsService.getJobs(user.id, 50);
    if (fetched) setJobs(fetched);
    setLoading(false);
  }, [user?.id]);

  useEffect(() => { loadJobs(); }, [loadJobs]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadJobs();
    setRefreshing(false);
  }, [loadJobs]);

  const activeCount   = jobs.filter((j) => j.status === 'active').length;
  const pendingCount  = jobs.filter((j) => j.status === 'pending').length;
  const completeCount = jobs.filter((j) => j.status === 'complete').length;
  const recentJobs    = jobs.slice(0, 10);
  const firstName = user?.company_name?.split(' ')[0] ?? 'there';

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* Header */}
      <LinearGradient colors={[Colors.navy, Colors.navyLight]} style={styles.header}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.greeting}>Good day, {firstName} 👋</Text>
            <Text style={styles.headerSub}>RoomLensPro Dashboard</Text>
          </View>
          <TouchableOpacity onPress={() => router.push('/settings')} style={styles.avatarBtn}>
            <Ionicons name="person-circle-outline" size={36} color="rgba(255,255,255,0.85)" />
          </TouchableOpacity>
        </View>

        {/* Stats row */}
        <View style={styles.statsRow}>
          <StatCard value={activeCount}   label="Active"   icon="flash-outline"         color={Colors.success} />
          <StatCard value={pendingCount}  label="Pending"  icon="time-outline"           color={Colors.warning} />
          <StatCard value={completeCount} label="Done"     icon="checkmark-circle-outline" color={Colors.info} />
          <StatCard value={jobs.length}   label="Total"    icon="briefcase-outline"      color={Colors.gold} />
        </View>
      </LinearGradient>

      <ScrollView
        style={styles.body}
        contentContainerStyle={styles.bodyContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.red} />}
        showsVerticalScrollIndicator={false}
      >
        {/* New Job CTA */}
        <TouchableOpacity style={styles.newJobBtn} onPress={() => router.push('/job/new')} activeOpacity={0.9}>
          <LinearGradient colors={[Colors.red, Colors.redDark]} style={styles.newJobGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
            <Ionicons name="add-circle-outline" size={26} color="#fff" />
            <View style={{ marginLeft: 12 }}>
              <Text style={styles.newJobTitle}>New Job</Text>
              <Text style={styles.newJobSub}>Start a new restoration file</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="rgba(255,255,255,0.7)" style={{ marginLeft: 'auto' }} />
          </LinearGradient>
        </TouchableOpacity>

        {/* Recent Jobs */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent Jobs</Text>
            <TouchableOpacity onPress={() => router.push('/(tabs)/jobs')}>
              <Text style={styles.seeAll}>See all →</Text>
            </TouchableOpacity>
          </View>

          {loading && jobs.length === 0 ? (
            <View style={styles.emptyBox}>
              <Ionicons name="hourglass-outline" size={40} color={Colors.textMuted} />
              <Text style={styles.emptyText}>Loading jobs...</Text>
            </View>
          ) : recentJobs.length === 0 ? (
            <View style={styles.emptyBox}>
              <Ionicons name="folder-open-outline" size={48} color={Colors.textMuted} />
              <Text style={styles.emptyTitle}>No jobs yet</Text>
              <Text style={styles.emptyText}>Tap "New Job" to create your first restoration file</Text>
            </View>
          ) : (
            recentJobs.map((job) => (
              <JobCard
                key={job.id}
                job={job}
                onPress={() => router.push(`/job/${job.id}` as any)}
              />
            ))
          )}
        </View>

        {/* Quick tips */}
        <View style={styles.tipCard}>
          <Ionicons name="bulb-outline" size={20} color={Colors.gold} />
          <Text style={styles.tipText}>
            <Text style={{ fontWeight: '700' }}>Pro tip: </Text>
            Capture 360° photos at 1.2 m camera height, room center, for best floor plan accuracy.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { paddingTop: 56, paddingHorizontal: Spacing.md, paddingBottom: 0 },
  headerRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginBottom: Spacing.md,
  },
  greeting: { fontSize: FontSize.lg, fontWeight: '700', color: '#fff' },
  headerSub: { fontSize: FontSize.xs, color: 'rgba(255,255,255,0.6)', marginTop: 2 },
  avatarBtn: { padding: 4 },

  statsRow: {
    flexDirection: 'row', gap: 8,
    paddingBottom: Spacing.lg,
  },
  statCard: {
    flex: 1, backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: Radius.md, padding: 10, alignItems: 'center',
  },
  statIcon: {
    width: 34, height: 34, borderRadius: 10,
    justifyContent: 'center', alignItems: 'center', marginBottom: 4,
  },
  statValue: { fontSize: FontSize.xl, fontWeight: '800', color: '#fff' },
  statLabel: { fontSize: FontSize.xs, color: 'rgba(255,255,255,0.65)', marginTop: 1 },

  body: { flex: 1 },
  bodyContent: { padding: Spacing.md, paddingBottom: 40 },

  newJobBtn: { borderRadius: Radius.lg, overflow: 'hidden', marginBottom: Spacing.lg, ...Shadow.md },
  newJobGradient: {
    flexDirection: 'row', alignItems: 'center',
    padding: Spacing.md, paddingVertical: 18,
  },
  newJobTitle: { fontSize: FontSize.md, fontWeight: '800', color: '#fff' },
  newJobSub: { fontSize: FontSize.xs, color: 'rgba(255,255,255,0.7)', marginTop: 2 },

  section: { marginBottom: Spacing.lg },
  sectionHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  sectionTitle: { fontSize: FontSize.md, fontWeight: '700', color: Colors.textPrimary },
  seeAll: { fontSize: FontSize.sm, color: Colors.red, fontWeight: '600' },

  jobCard: {
    backgroundColor: Colors.card, borderRadius: Radius.md,
    padding: Spacing.md, marginBottom: Spacing.sm,
    flexDirection: 'row', alignItems: 'center',
    ...Shadow.sm,
  },
  jobCardLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  jobCardRight: { alignItems: 'flex-end' },
  jobIcon: {
    width: 42, height: 42, borderRadius: 12,
    backgroundColor: Colors.background,
    justifyContent: 'center', alignItems: 'center',
  },
  jobAddress: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.textPrimary },
  jobType: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 2 },
  jobDate: { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 1 },

  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: Radius.full },
  badgeText: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },

  emptyBox: { alignItems: 'center', padding: Spacing.xl },
  emptyTitle: { fontSize: FontSize.md, fontWeight: '700', color: Colors.textPrimary, marginTop: 12 },
  emptyText: { fontSize: FontSize.sm, color: Colors.textMuted, textAlign: 'center', marginTop: 6, lineHeight: 20 },

  tipCard: {
    backgroundColor: '#fff8e1', borderRadius: Radius.md,
    padding: Spacing.md, flexDirection: 'row', gap: 10, alignItems: 'flex-start',
  },
  tipText: { flex: 1, fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 20 },
});
