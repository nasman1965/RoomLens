import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  RefreshControl, StatusBar, TextInput, ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore, useJobsStore } from '../../src/store';
import { jobsService } from '../../src/services/jobs';
import { Colors, FontSize, Spacing, Radius, Shadow } from '../../src/constants/theme';
import { Job } from '../../src/types';

const STATUS_CONFIG: Record<string, { label: string; bg: string; color: string }> = {
  new:        { label: 'New',        bg: '#e8f4fd', color: '#3b82f6' },
  dispatched: { label: 'Dispatched', bg: '#fff8e1', color: '#f59e0b' },
  active:     { label: 'Active',     bg: '#e8fdf0', color: '#22c55e' },
  review:     { label: 'In Review',  bg: '#f3e8ff', color: '#9333ea' },
  closed:     { label: 'Closed',     bg: '#f0f4f8', color: '#64748b' },
  stopped:    { label: 'Stopped',    bg: '#fee2e2', color: '#ef4444' },
};

const FILTERS = [
  { value: 'all',      label: 'All' },
  { value: 'active',   label: 'Active' },
  { value: 'new',      label: 'New' },
  { value: 'stopped',  label: 'Stopped' },
  { value: 'closed',   label: 'Closed' },
];

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? { label: status, bg: '#f0f4f8', color: '#64748b' };
  return (
    <View style={[styles.badge, { backgroundColor: cfg.bg }]}>
      <Text style={[styles.badgeText, { color: cfg.color }]}>{cfg.label}</Text>
    </View>
  );
}

function JobCard({ job, onPress }: { job: Job; onPress: () => void }) {
  return (
    <TouchableOpacity style={[styles.card, job.stopped && styles.cardStopped]} onPress={onPress} activeOpacity={0.8}>
      <View style={styles.cardHeader}>
        <View style={styles.cardStep}>
          <Text style={styles.cardStepText}>Step {job.current_step}/15</Text>
        </View>
        <StatusBadge status={job.stopped ? 'stopped' : job.status} />
      </View>

      <Text style={styles.cardName} numberOfLines={1}>{job.insured_name || 'Unnamed Job'}</Text>
      <Text style={styles.cardAddress} numberOfLines={1}>
        <Ionicons name="location-outline" size={12} color={Colors.textMuted} /> {job.property_address}
        {job.property_city ? `, ${job.property_city}` : ''}
      </Text>

      {job.claim_number ? (
        <Text style={styles.cardClaim}>Claim #{job.claim_number}</Text>
      ) : null}

      {job.stopped ? (
        <View style={styles.stoppedBanner}>
          <Ionicons name="stop-circle" size={12} color="#ef4444" />
          <Text style={styles.stoppedText}> Stopped — {job.stop_reason?.replace(/_/g, ' ')}</Text>
        </View>
      ) : null}

      <View style={styles.cardFooter}>
        <Text style={styles.cardDate}>
          {new Date(job.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
        </Text>
        <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
      </View>
    </TouchableOpacity>
  );
}

export default function JobsScreen() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { jobs, setJobs } = useJobsStore();
  const [loading, setLoading]     = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter]       = useState('all');
  const [search, setSearch]       = useState('');

  const loadJobs = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    const { jobs: fetched } = await jobsService.getJobs();
    if (fetched) setJobs(fetched);
    setLoading(false);
  }, [user?.id]);

  useEffect(() => { loadJobs(); }, [loadJobs]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadJobs();
    setRefreshing(false);
  }, [loadJobs]);

  const filtered = jobs.filter((j) => {
    const matchFilter = filter === 'all'
      || (filter === 'stopped' ? j.stopped : j.status === filter);
    const q = search.toLowerCase();
    const matchSearch = !q
      || j.insured_name?.toLowerCase().includes(q)
      || j.property_address.toLowerCase().includes(q)
      || j.claim_number?.toLowerCase().includes(q)
      || j.insurer_name?.toLowerCase().includes(q);
    return matchFilter && matchSearch;
  });

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />

      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Jobs</Text>
          <Text style={styles.subtitle}>{jobs.length} total · {jobs.filter(j => j.status === 'active').length} active</Text>
        </View>
        <TouchableOpacity style={styles.newBtn} onPress={() => router.push('/job/new')} activeOpacity={0.85}>
          <Ionicons name="add" size={22} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Search */}
      <View style={styles.searchRow}>
        <Ionicons name="search-outline" size={18} color={Colors.textMuted} style={{ marginRight: 8 }} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search by name, address, claim #..."
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

      {/* Filters */}
      <FlatList
        data={FILTERS}
        horizontal
        keyExtractor={f => f.value}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterRow}
        renderItem={({ item: f }) => (
          <TouchableOpacity
            style={[styles.filterChip, filter === f.value && styles.filterChipActive]}
            onPress={() => setFilter(f.value)}
          >
            <Text style={[styles.filterText, filter === f.value && styles.filterTextActive]}>
              {f.label}
            </Text>
          </TouchableOpacity>
        )}
      />

      {/* List */}
      {loading && !refreshing ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.navy} />
          <Text style={styles.loadingText}>Loading jobs...</Text>
        </View>
      ) : filtered.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="folder-open-outline" size={48} color={Colors.textMuted} />
          <Text style={styles.emptyTitle}>{jobs.length === 0 ? 'No jobs yet' : 'No results'}</Text>
          <Text style={styles.emptyText}>
            {jobs.length === 0 ? 'Tap + to create your first job' : 'Try a different search or filter'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={j => j.id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.navy} />}
          renderItem={({ item }) => (
            <JobCard job={item} onPress={() => router.push(`/job/${item.id}` as any)} />
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container:      { flex: 1, backgroundColor: Colors.background },
  header:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.lg, paddingTop: 56, paddingBottom: Spacing.md, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: Colors.border },
  title:          { fontSize: FontSize.xl, fontWeight: '700', color: Colors.textPrimary },
  subtitle:       { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 2 },
  newBtn:         { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.navy, alignItems: 'center', justifyContent: 'center' },
  searchRow:      { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', marginHorizontal: Spacing.lg, marginTop: Spacing.md, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: Spacing.md, paddingVertical: 10 },
  searchInput:    { flex: 1, fontSize: FontSize.sm, color: Colors.textPrimary },
  filterRow:      { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm, gap: 8 },
  filterChip:     { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: Colors.border, backgroundColor: '#fff' },
  filterChipActive: { backgroundColor: Colors.navy, borderColor: Colors.navy },
  filterText:     { fontSize: FontSize.xs, color: Colors.textSecondary, fontWeight: '500' },
  filterTextActive: { color: '#fff' },
  list:           { padding: Spacing.lg, gap: 12 },
  card:           { backgroundColor: '#fff', borderRadius: Radius.lg, padding: Spacing.md, ...Shadow.sm, borderWidth: 1, borderColor: Colors.border },
  cardStopped:    { borderColor: '#fca5a5', backgroundColor: '#fff5f5' },
  cardHeader:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  cardStep:       { backgroundColor: '#f0f4f8', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  cardStepText:   { fontSize: 10, color: Colors.textMuted, fontWeight: '600' },
  badge:          { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  badgeText:      { fontSize: 11, fontWeight: '600' },
  cardName:       { fontSize: FontSize.md, fontWeight: '700', color: Colors.textPrimary, marginBottom: 3 },
  cardAddress:    { fontSize: FontSize.xs, color: Colors.textSecondary, marginBottom: 4 },
  cardClaim:      { fontSize: FontSize.xs, color: Colors.textMuted, marginBottom: 4 },
  stoppedBanner:  { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fee2e2', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4, marginBottom: 6 },
  stoppedText:    { fontSize: 11, color: '#ef4444', fontWeight: '600' },
  cardFooter:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 },
  cardDate:       { fontSize: FontSize.xs, color: Colors.textMuted },
  center:         { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.xl },
  emptyTitle:     { fontSize: FontSize.lg, fontWeight: '600', color: Colors.textPrimary, marginTop: Spacing.md },
  emptyText:      { fontSize: FontSize.sm, color: Colors.textMuted, textAlign: 'center', marginTop: 6 },
  loadingText:    { fontSize: FontSize.sm, color: Colors.textMuted, marginTop: Spacing.sm },
});
