import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, StatusBar,
  KeyboardAvoidingView, Platform, TouchableOpacity, Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import Input from '../../src/components/ui/Input';
import Button from '../../src/components/ui/Button';
import { jobsService } from '../../src/services/jobs';
import { useAuthStore, useJobsStore } from '../../src/store';
import { Colors, FontSize, Spacing, Radius, Shadow } from '../../src/constants/theme';
import { JOB_TYPES, JobType } from '../../src/constants/app';

export default function NewJobScreen() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { addJob } = useJobsStore();

  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [jobType, setJobType] = useState<JobType>('water_loss');
  const [gps, setGps] = useState<{ lat: number; lng: number } | null>(null);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ address?: string; general?: string }>({});

  const getLocation = async () => {
    setGpsLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Location permission is needed to auto-fill GPS coordinates.');
        return;
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setGps({ lat: loc.coords.latitude, lng: loc.coords.longitude });

      // Reverse geocode for address suggestion
      const [geo] = await Location.reverseGeocodeAsync(loc.coords);
      if (geo && !address) {
        const parts = [geo.streetNumber, geo.street, geo.city, geo.region].filter(Boolean);
        setAddress(parts.join(' '));
      }
    } catch (err: any) {
      Alert.alert('GPS Error', err.message ?? 'Unable to get location');
    } finally {
      setGpsLoading(false);
    }
  };

  const handleCreate = async () => {
    const e: typeof errors = {};
    if (!address.trim()) e.address = 'Property address is required';
    if (Object.keys(e).length) { setErrors(e); return; }

    if (!user?.id) { setErrors({ general: 'Not logged in' }); return; }

    setLoading(true);
    const { job, error } = await jobsService.createJob({
      userId: user.id,
      address: address.trim(),
      jobType,
      notes: notes.trim() || undefined,
      gpsLat: gps?.lat,
      gpsLng: gps?.lng,
    });
    setLoading(false);

    if (error || !job) {
      setErrors({ general: error ?? 'Failed to create job' });
      return;
    }

    addJob(job);
    router.replace(`/job/${job.id}` as any);
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <StatusBar barStyle="dark-content" />

      {/* Modal header */}
      <View style={styles.modalHeader}>
        <TouchableOpacity onPress={() => router.back()} style={styles.closeBtn}>
          <Ionicons name="close" size={22} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.modalTitle}>New Job</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent} keyboardShouldPersistTaps="handled">

        {errors.general ? (
          <View style={styles.errorBanner}>
            <Ionicons name="alert-circle-outline" size={16} color={Colors.error} />
            <Text style={styles.errorBannerText}>{errors.general}</Text>
          </View>
        ) : null}

        {/* Address */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Property Address</Text>
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-start' }}>
            <View style={{ flex: 1 }}>
              <Input
                icon="home-outline"
                placeholder="123 Main St, City, Province"
                value={address}
                onChangeText={(t) => { setAddress(t); setErrors((e) => ({ ...e, address: undefined })); }}
                error={errors.address}
                autoCapitalize="words"
              />
            </View>
            <TouchableOpacity
              onPress={getLocation}
              style={[styles.gpsBtn, gps && styles.gpsBtnActive]}
              disabled={gpsLoading}
            >
              <Ionicons
                name={gps ? 'location' : 'locate-outline'}
                size={20}
                color={gps ? '#fff' : Colors.navy}
              />
              {gpsLoading && <Text style={{ fontSize: 8, color: gps ? '#fff' : Colors.navy, marginTop: 2 }}>…</Text>}
            </TouchableOpacity>
          </View>
          {gps ? (
            <Text style={styles.gpsTag}>
              <Ionicons name="checkmark-circle" size={12} color={Colors.success} />
              {' '}GPS: {gps.lat.toFixed(5)}, {gps.lng.toFixed(5)}
            </Text>
          ) : null}
        </View>

        {/* Job Type */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Job Type</Text>
          <View style={styles.typeGrid}>
            {JOB_TYPES.map((type) => (
              <TouchableOpacity
                key={type.value}
                style={[styles.typeChip, jobType === type.value && styles.typeChipActive]}
                onPress={() => setJobType(type.value)}
                activeOpacity={0.8}
              >
                <Ionicons
                  name={type.icon as any}
                  size={18}
                  color={jobType === type.value ? '#fff' : Colors.textSecondary}
                />
                <Text style={[styles.typeLabel, jobType === type.value && styles.typeLabelActive]}>
                  {type.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Notes */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Notes (Optional)</Text>
          <Input
            icon="document-text-outline"
            placeholder="Insurance claim #, adjuster name, special instructions…"
            value={notes}
            onChangeText={setNotes}
            multiline
            numberOfLines={3}
            containerStyle={{ marginBottom: 0 }}
          />
        </View>

        {/* Summary card */}
        {address ? (
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Job Summary</Text>
            <View style={styles.summaryRow}>
              <Ionicons name="home-outline" size={15} color={Colors.textMuted} />
              <Text style={styles.summaryValue} numberOfLines={2}>{address}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Ionicons name={(JOB_TYPES.find((t) => t.value === jobType)?.icon ?? 'construct-outline') as any} size={15} color={Colors.textMuted} />
              <Text style={styles.summaryValue}>{JOB_TYPES.find((t) => t.value === jobType)?.label}</Text>
            </View>
            {gps ? (
              <View style={styles.summaryRow}>
                <Ionicons name="location-outline" size={15} color={Colors.success} />
                <Text style={[styles.summaryValue, { color: Colors.success }]}>GPS coordinates captured</Text>
              </View>
            ) : null}
          </View>
        ) : null}

        <Button
          title="Create Job"
          onPress={handleCreate}
          loading={loading}
          icon="add-circle-outline"
          iconPosition="right"
          size="lg"
          style={{ marginTop: Spacing.md }}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  modalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingHorizontal: Spacing.md, paddingBottom: Spacing.sm,
    backgroundColor: Colors.card, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  closeBtn: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background },
  modalTitle: { fontSize: FontSize.lg, fontWeight: '800', color: Colors.textPrimary },
  body: { flex: 1, backgroundColor: Colors.background },
  bodyContent: { padding: Spacing.md, paddingBottom: 50 },
  errorBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#fff0f1', borderRadius: Radius.sm,
    padding: 12, marginBottom: Spacing.md,
    borderLeftWidth: 3, borderLeftColor: Colors.error,
  },
  errorBannerText: { color: Colors.error, fontSize: FontSize.sm, flex: 1 },
  section: { marginBottom: Spacing.lg },
  sectionTitle: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.textPrimary, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 },
  gpsBtn: {
    width: 52, height: 52, borderRadius: Radius.md,
    backgroundColor: Colors.background,
    borderWidth: 1.5, borderColor: Colors.border,
    justifyContent: 'center', alignItems: 'center', marginTop: 0,
  },
  gpsBtnActive: { backgroundColor: Colors.success, borderColor: Colors.success },
  gpsTag: { fontSize: FontSize.xs, color: Colors.success, marginTop: 4, marginLeft: 4 },
  typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  typeChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 10,
    borderRadius: Radius.md, borderWidth: 1.5,
    borderColor: Colors.border, backgroundColor: Colors.card,
    ...Shadow.sm,
  },
  typeChipActive: { backgroundColor: Colors.navy, borderColor: Colors.navy },
  typeLabel: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.textSecondary },
  typeLabelActive: { color: '#fff' },
  summaryCard: {
    backgroundColor: Colors.card, borderRadius: Radius.md,
    padding: Spacing.md, marginBottom: Spacing.sm,
    borderLeftWidth: 3, borderLeftColor: Colors.red,
    ...Shadow.sm,
  },
  summaryLabel: { fontSize: FontSize.xs, fontWeight: '700', color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  summaryRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  summaryValue: { fontSize: FontSize.sm, color: Colors.textPrimary, fontWeight: '500', flex: 1 },
});
