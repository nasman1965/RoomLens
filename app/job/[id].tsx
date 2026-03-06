import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, StatusBar,
  TouchableOpacity, Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { jobsService } from '../../src/services/jobs';
import { useAuthStore, useJobsStore } from '../../src/store';
import { Colors, FontSize, Spacing, Radius, Shadow } from '../../src/constants/theme';
import { JOB_TYPES } from '../../src/constants/app';
import { Job } from '../../src/types';

// ─── Module Tile ──────────────────────────────────────────────────────────────
interface ModuleTile {
  id: string;
  title: string;
  subtitle: string;
  icon: string;
  color: string;
  route: string;
  badge?: string;
  available: boolean;
}

function TileCard({ tile, jobId }: { tile: ModuleTile; jobId: string }) {
  const router = useRouter();
  return (
    <TouchableOpacity
      style={[styles.tile, !tile.available && styles.tileDisabled]}
      onPress={() => tile.available && router.push(`${tile.route}/${jobId}` as any)}
      activeOpacity={tile.available ? 0.85 : 1}
    >
      <View style={[styles.tileIcon, { backgroundColor: `${tile.color}18` }]}>
        <Ionicons name={tile.icon as any} size={28} color={tile.color} />
      </View>
      <Text style={styles.tileTitle}>{tile.title}</Text>
      <Text style={styles.tileSub} numberOfLines={2}>{tile.subtitle}</Text>
      {tile.badge ? (
        <View style={[styles.tileBadge, { backgroundColor: tile.color }]}>
          <Text style={styles.tileBadgeText}>{tile.badge}</Text>
        </View>
      ) : null}
      {!tile.available && (
        <View style={styles.tileLock}>
          <Ionicons name="lock-closed" size={12} color={Colors.textMuted} />
          <Text style={styles.tileLockText}>PRO</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

// ─── Status Selector ─────────────────────────────────────────────────────────
const STATUS_OPTIONS: Array<{ value: Job['status']; label: string; color: string }> = [
  { value: 'draft',    label: 'Draft',    color: Colors.textMuted },
  { value: 'active',   label: 'Active',   color: Colors.success },
  { value: 'pending',  label: 'Pending',  color: Colors.warning },
  { value: 'complete', label: 'Complete', color: Colors.info },
];

export default function JobDashboardScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuthStore();
  const { activeJob, setActiveJob, updateJob } = useJobsStore();
  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusChanging, setStatusChanging] = useState(false);

  useEffect(() => {
    if (!id) return;
    loadJob();
  }, [id]);

  const loadJob = async () => {
    setLoading(true);
    const { job: fetched } = await jobsService.getJob(id!);
    if (fetched) {
      setJob(fetched);
      setActiveJob(fetched);
    }
    setLoading(false);
  };

  const handleStatusChange = async (newStatus: Job['status']) => {
    if (!job) return;
    setStatusChanging(true);
    const { error } = await jobsService.updateJobStatus(job.id, newStatus);
    if (!error) {
      const updated = { ...job, status: newStatus };
      setJob(updated);
      setActiveJob(updated);
      updateJob(job.id, { status: newStatus });
    }
    setStatusChanging(false);
  };

  const confirmDelete = () => {
    Alert.alert(
      'Delete Job',
      'This will permanently delete the job and all associated data. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete', style: 'destructive',
          onPress: async () => {
            await jobsService.deleteJob(id!);
            router.replace('/(tabs)');
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingBox}>
        <Ionicons name="hourglass-outline" size={40} color={Colors.textMuted} />
        <Text style={styles.loadingText}>Loading job...</Text>
      </View>
    );
  }

  if (!job) {
    return (
      <View style={styles.loadingBox}>
        <Ionicons name="warning-outline" size={40} color={Colors.error} />
        <Text style={styles.loadingText}>Job not found</Text>
        <TouchableOpacity onPress={() => router.back()} style={styles.backLink}>
          <Text style={{ color: Colors.red }}>← Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const meta = JOB_TYPES.find((t) => t.value === job.job_type);
  const isStarter = user?.subscription_tier === 'starter' || user?.subscription_tier === 'pro' || user?.subscription_tier === 'enterprise';

  const tiles: ModuleTile[] = [
    {
      id: 'floorplan',
      title: '360° Floor Plan',
      subtitle: 'Capture rooms, generate dimensioned floor plan',
      icon: 'scan-outline',
      color: Colors.tileFloorplan,
      route: '/floorplan',
      available: true,
    },
    {
      id: 'moisture',
      title: 'Moisture Map',
      subtitle: 'Pin readings, track drying per IICRC S500',
      icon: 'water-outline',
      color: Colors.tileMoisture,
      route: '/moisture',
      available: isStarter,
    },
    {
      id: 'photos',
      title: 'Damage Photos',
      subtitle: 'Capture & AI-analyse damage with Xactimate items',
      icon: 'camera-outline',
      color: Colors.tilePhotos,
      route: '/photos',
      available: isStarter,
    },
    {
      id: 'estimate',
      title: 'Estimate Draft',
      subtitle: 'Review AI-generated Xactimate line items',
      icon: 'document-text-outline',
      color: Colors.tileEstimate,
      route: '/estimate',
      available: isStarter,
    },
  ];

  const statusInfo = STATUS_OPTIONS.find((s) => s.value === job.status) ?? STATUS_OPTIONS[0];
  const createdDate = new Date(job.created_at).toLocaleDateString('en-CA', {
    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
  });

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* Header */}
      <LinearGradient colors={[Colors.navy, Colors.navyLight]} style={styles.header}>
        <View style={styles.headerTop}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={22} color="#fff" />
          </TouchableOpacity>
          <View style={styles.headerActions}>
            <TouchableOpacity onPress={confirmDelete} style={styles.headerActionBtn}>
              <Ionicons name="trash-outline" size={18} color="rgba(255,255,255,0.7)" />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.headerJobType}>
          <Ionicons name={meta?.icon as any ?? 'construct-outline'} size={16} color="rgba(255,255,255,0.7)" />
          <Text style={styles.headerJobTypeText}>{meta?.label ?? job.job_type}</Text>
        </View>
        <Text style={styles.headerAddress} numberOfLines={2}>{job.property_address}</Text>
        <Text style={styles.headerDate}>{createdDate}</Text>

        {/* Status chips */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.statusRow} contentContainerStyle={{ gap: 8 }}>
          {STATUS_OPTIONS.map((opt) => (
            <TouchableOpacity
              key={opt.value}
              style={[styles.statusChip, job.status === opt.value && { backgroundColor: opt.color }]}
              onPress={() => handleStatusChange(opt.value)}
              disabled={statusChanging}
            >
              <Text style={[styles.statusChipText, job.status === opt.value && { color: '#fff' }]}>
                {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </LinearGradient>

      {/* Module tiles */}
      <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent} showsVerticalScrollIndicator={false}>
        <Text style={styles.sectionTitle}>Modules</Text>
        <View style={styles.tileGrid}>
          {tiles.map((tile) => (
            <TileCard key={tile.id} tile={tile} jobId={job.id} />
          ))}
        </View>

        {/* Notes */}
        {job.notes ? (
          <View style={styles.notesCard}>
            <Text style={styles.notesLabel}>Notes</Text>
            <Text style={styles.notesText}>{job.notes}</Text>
          </View>
        ) : null}

        {/* Upgrade prompt for free tier */}
        {!isStarter && (
          <View style={styles.upgradeCard}>
            <LinearGradient colors={[Colors.navy, Colors.navyLight]} style={styles.upgradeGradient}>
              <Ionicons name="star-outline" size={24} color={Colors.gold} />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.upgradeTitle}>Unlock All Modules</Text>
                <Text style={styles.upgradeSub}>Moisture mapping, AI photos & estimate drafts from $99 CAD/mo</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={Colors.gold} />
            </LinearGradient>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { paddingBottom: Spacing.md },
  headerTop: {
    paddingTop: 56, paddingHorizontal: Spacing.md,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center', alignItems: 'center',
  },
  headerActions: { flexDirection: 'row', gap: 8 },
  headerActionBtn: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center', alignItems: 'center',
  },
  headerJobType: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: Spacing.md, marginBottom: 4,
  },
  headerJobTypeText: { fontSize: FontSize.xs, color: 'rgba(255,255,255,0.7)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1 },
  headerAddress: { fontSize: FontSize.xl, fontWeight: '800', color: '#fff', paddingHorizontal: Spacing.md },
  headerDate: { fontSize: FontSize.xs, color: 'rgba(255,255,255,0.55)', paddingHorizontal: Spacing.md, marginTop: 4 },
  statusRow: { marginTop: Spacing.sm, paddingHorizontal: Spacing.md },
  statusChip: {
    paddingHorizontal: 14, paddingVertical: 7,
    borderRadius: Radius.full,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  statusChipText: { fontSize: FontSize.xs, fontWeight: '700', color: 'rgba(255,255,255,0.7)' },
  body: { flex: 1 },
  bodyContent: { padding: Spacing.md, paddingBottom: 40 },
  sectionTitle: {
    fontSize: FontSize.sm, fontWeight: '700', color: Colors.textPrimary,
    textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: Spacing.sm,
  },
  tileGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: Spacing.lg },
  tile: {
    width: '47%', backgroundColor: Colors.card, borderRadius: Radius.lg,
    padding: Spacing.md, minHeight: 140,
    ...Shadow.md,
  },
  tileDisabled: { opacity: 0.65 },
  tileIcon: {
    width: 52, height: 52, borderRadius: 14,
    justifyContent: 'center', alignItems: 'center', marginBottom: 10,
  },
  tileTitle: { fontSize: FontSize.sm, fontWeight: '800', color: Colors.textPrimary, marginBottom: 4 },
  tileSub: { fontSize: FontSize.xs, color: Colors.textSecondary, lineHeight: 16 },
  tileBadge: {
    position: 'absolute', top: 10, right: 10,
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: Radius.full,
  },
  tileBadgeText: { fontSize: 9, fontWeight: '700', color: '#fff' },
  tileLock: {
    position: 'absolute', top: 10, right: 10,
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: Colors.background, borderRadius: Radius.full,
    paddingHorizontal: 6, paddingVertical: 2,
  },
  tileLockText: { fontSize: 9, fontWeight: '700', color: Colors.textMuted },
  notesCard: {
    backgroundColor: Colors.card, borderRadius: Radius.md, padding: Spacing.md,
    marginBottom: Spacing.md, borderLeftWidth: 3, borderLeftColor: Colors.gold,
    ...Shadow.sm,
  },
  notesLabel: { fontSize: FontSize.xs, fontWeight: '700', color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
  notesText: { fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 20 },
  upgradeCard: { borderRadius: Radius.lg, overflow: 'hidden', ...Shadow.md },
  upgradeGradient: { flexDirection: 'row', alignItems: 'center', padding: Spacing.md },
  upgradeTitle: { fontSize: FontSize.sm, fontWeight: '800', color: '#fff' },
  upgradeSub: { fontSize: FontSize.xs, color: 'rgba(255,255,255,0.65)', marginTop: 3, lineHeight: 16 },
  loadingBox: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background },
  loadingText: { fontSize: FontSize.sm, color: Colors.textMuted, marginTop: 12 },
  backLink: { marginTop: 16 },
});
