import React, { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  RefreshControl, StatusBar, TextInput,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore, useJobsStore } from '../../src/store';
import { jobsService } from '../../src/services/jobs';
import { Colors, FontSize, Spacing, Radius, Shadow } from '../../src/constants/theme';
import { Job } from '../../src/types';
import { JOB_TYPES } from '../../src/constants/app';

const STATUS_FILTERS: Array<{ value: Job['status'] | 'all'; label: string }> = [
  { value: 'all',      label: 'All' },
  { value: 'active',   label: 'Active' },
  { value: 'pending',  label: 'Pending' },
  { value: 'complete', label: 'Complete' },
  { value: 'draft',    label: 'Draft' },
];

function StatusBadge({ status }: { status: Job['status'] }) {
  const map: Record<Job['status'], { label: string; bg: string; color: string }> = {
    active:   { label: 'Active',   bg: '#e8fdf0', color: Colors.success },
    pending:  { label: 'Pending',  bg: '#fff8e1', color: Colors.warning },
    complete: { label: 'Complete', bg: '#e8f0fe', color: Colors.info },
    draft:    { label: 'Draft',    bg: '#f0f4f8', color: Colors.textMuted },
  };
  const { label, bg, color } = map[status] ?? map.draft;
  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      <Text style={[styles.badgeText, { color }]}>{label}</Text>
    </View>
  );
}

export default function JobsScreen() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { jobs, setJobs, setLoading, loading } = useJobsStore();
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<Job['status'] | 'all'>('all');
  const [search, setSearch] = useState('');

  const loadJobs = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    const { jobs: fetched } = await jobsService.getJobs(user.id, 100);
    if (fetched) setJobs(fetched);
    setLoading(false);
  }, [user?.id]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadJobs();
    setRefreshing(false);
  }, [loadJobs]);

  const filtered = jobs.filter((j) => {
    const matchFilter = filter === 'all' || j.status === filter;
    const matchSearch = !search || j.property_address.toLowerCase().includes(search.toLowerCase());
    return matchFilter && matchSearch;
  });

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>All Jobs</Text>
        <TouchableOpacity
          style={styles.newBtn}
          onPress={() => router.push('/job/new')}
          activeOpacity={0.85}
        >
          <Ionicons name="add" size={22} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Search */}
      <View style={styles.searchRow}>
        <Ionicons name="search-outline" size={18} color={Colors.textMuted} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search by address..."
          placeholderTextColor={Colors.textMuted}
          value={search}
          onChangeText={setSearch}
          autoCorrect={false}
        />
        {search ? (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Ionicons name="close-circle" size={18} color={Colors.textMuted} />
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Filter chips */}
      <FlatList
        data={STATUS_FILTERS}
        horizontal
        showsHorizontalScrollIndicator={false}
        keyExtractor={(item) => item.value}
        contentContainerStyle={styles.filterRow}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.filterChip, filter === item.value && styles.filterChipActive]}
            onPress={() => setFilter(item.value as any)}
          >
            <Text style={[styles.filterText, filter === item.value && styles.filterTextActive]}>
              {item.label}
            </Text>
          </TouchableOpacity>
        )}
      />

      {/* Jobs list */}
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.red} />
        }
        ListEmptyComponent={
          <View style={styles.emptyBox}>
            <Ionicons name="folder-open-outline" size={52} color={Colors.textMuted} />
            <Text style={styles.emptyTitle}>
              {search ? 'No results' : 'No jobs yet'}
            </Text>
            <Text style={styles.emptyText}>
              {search
                ? `No jobs match "${search}"`
                : 'Tap the + button to create your first job'}
            </Text>
          </View>
        }
        renderItem={({ item: job }) => {
          const meta = JOB_TYPES.find((t) => t.value === job.job_type);
          const date = new Date(job.created_at).toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' });
          return (
            <TouchableOpacity
              style={styles.jobCard}
              onPress={() => router.push(`/job/${job.id}` as any)}
              activeOpacity={0.85}
            >
              <View style={styles.jobIcon}>
                <Ionicons name={meta?.icon as any ?? 'construct-outline'} size={22} color={Colors.navy} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.jobAddress} numberOfLines={1}>{job.property_address}</Text>
                <Text style={styles.jobMeta}>{meta?.label ?? job.job_type} · {date}</Text>
                {job.notes ? <Text style={styles.jobNotes} numberOfLines={1}>{job.notes}</Text> : null}
              </View>
              <View style={styles.jobRight}>
                <StatusBadge status={job.status} />
                <Ionicons name="chevron-forward" size={15} color={Colors.textMuted} style={{ marginTop: 6 }} />
              </View>
            </TouchableOpacity>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    paddingTop: 56, paddingHorizontal: Spacing.md, paddingBottom: Spacing.sm,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: Colors.card, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  title: { fontSize: FontSize.xxl, fontWeight: '800', color: Colors.textPrimary },
  newBtn: {
    width: 38, height: 38, borderRadius: 12,
    backgroundColor: Colors.red,
    justifyContent: 'center', alignItems: 'center',
  },
  searchRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.card, borderBottomWidth: 1, borderBottomColor: Colors.border,
    paddingHorizontal: Spacing.md, paddingVertical: 8,
  },
  searchIcon: { marginRight: 8 },
  searchInput: {
    flex: 1, fontSize: FontSize.sm,
    color: Colors.textPrimary, height: 38,
  },
  filterRow: { paddingHorizontal: Spacing.md, paddingVertical: 10, gap: 8 },
  filterChip: {
    paddingHorizontal: 14, paddingVertical: 6,
    borderRadius: Radius.full, backgroundColor: Colors.card,
    borderWidth: 1.5, borderColor: Colors.border,
  },
  filterChipActive: { backgroundColor: Colors.navy, borderColor: Colors.navy },
  filterText: { fontSize: FontSize.xs, fontWeight: '600', color: Colors.textSecondary },
  filterTextActive: { color: '#fff' },
  listContent: { padding: Spacing.md, paddingTop: 4, paddingBottom: 40 },
  jobCard: {
    backgroundColor: Colors.card, borderRadius: Radius.md,
    padding: Spacing.md, marginBottom: Spacing.sm,
    flexDirection: 'row', alignItems: 'center', gap: 12,
    ...Shadow.sm,
  },
  jobIcon: {
    width: 44, height: 44, borderRadius: 12,
    backgroundColor: Colors.background,
    justifyContent: 'center', alignItems: 'center',
  },
  jobAddress: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.textPrimary },
  jobMeta: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 3 },
  jobNotes: { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 2, fontStyle: 'italic' },
  jobRight: { alignItems: 'flex-end' },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: Radius.full },
  badgeText: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  emptyBox: { alignItems: 'center', paddingTop: 60, paddingHorizontal: 40 },
  emptyTitle: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.textPrimary, marginTop: 16 },
  emptyText: { fontSize: FontSize.sm, color: Colors.textMuted, textAlign: 'center', marginTop: 8, lineHeight: 20 },
});
