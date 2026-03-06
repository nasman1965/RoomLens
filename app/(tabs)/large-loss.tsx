import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, StatusBar, ScrollView,
  FlatList, Alert, Image, ActivityIndicator, Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { Colors, FontSize, Spacing, Radius, Shadow } from '../../src/constants/theme';

// ─── Types ────────────────────────────────────────────────────────────────────
interface LargePhoto {
  id: string;
  uri: string;
  floor: string;
  area: string;
  timestamp: string;
  synced: boolean;
}

const FLOORS = ['Basement', 'Ground Floor', '2nd Floor', '3rd Floor', 'Roof'];
const AREAS  = ['Interior', 'Exterior', 'Structural', 'HVAC', 'Electrical', 'Other'];

// ─── Photo thumbnail ──────────────────────────────────────────────────────────
function PhotoThumb({ photo }: { photo: LargePhoto }) {
  return (
    <View style={styles.thumb}>
      <Image source={{ uri: photo.uri }} style={styles.thumbImg} resizeMode="cover" />
      <View style={styles.thumbOverlay}>
        <Text style={styles.thumbFloor}>{photo.floor}</Text>
        {photo.synced
          ? <Ionicons name="checkmark-circle" size={14} color={Colors.success} />
          : <Ionicons name="cloud-upload-outline" size={14} color="rgba(255,255,255,0.7)" />
        }
      </View>
      <Text style={styles.thumbArea}>{photo.area}</Text>
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function LargeLossTab() {
  const router = useRouter();

  const [photos, setPhotos]             = useState<LargePhoto[]>([]);
  const [activeFloor, setActiveFloor]   = useState(FLOORS[1]);
  const [activeArea, setActiveArea]     = useState(AREAS[0]);
  const [capturing, setCapturing]       = useState(false);
  const [syncing, setSyncing]           = useState(false);

  // ── Rapid capture ──────────────────────────────────────────────────────────
  const capturePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Needed', 'Camera access is required for Large Loss documentation.');
      return;
    }
    setCapturing(true);
    try {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.85,
        allowsEditing: false,
        exif: true,
      });
      if (!result.canceled && result.assets?.[0]) {
        const newPhoto: LargePhoto = {
          id: `ll-${Date.now()}`,
          uri: result.assets[0].uri,
          floor: activeFloor,
          area: activeArea,
          timestamp: new Date().toISOString(),
          synced: false,
        };
        setPhotos((prev) => [newPhoto, ...prev]);
      }
    } finally {
      setCapturing(false);
    }
  };

  // ── Import from library ────────────────────────────────────────────────────
  const importPhotos = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Needed', 'Photo library access is required.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 0.85,
    });
    if (!result.canceled && result.assets) {
      const newPhotos: LargePhoto[] = result.assets.map((a) => ({
        id: `ll-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        uri: a.uri,
        floor: activeFloor,
        area: activeArea,
        timestamp: new Date().toISOString(),
        synced: false,
      }));
      setPhotos((prev) => [...newPhotos, ...prev]);
    }
  };

  // ── Simulate background sync ───────────────────────────────────────────────
  const syncPhotos = async () => {
    const unsynced = photos.filter((p) => !p.synced);
    if (unsynced.length === 0) { Alert.alert('All synced', 'No new photos to upload.'); return; }
    setSyncing(true);
    await new Promise((r) => setTimeout(r, 1500));
    setPhotos((prev) => prev.map((p) => ({ ...p, synced: true })));
    setSyncing(false);
    Alert.alert('Sync Complete', `${unsynced.length} photo${unsynced.length !== 1 ? 's' : ''} uploaded successfully.`);
  };

  // ── Export ZIP manifest ────────────────────────────────────────────────────
  const exportManifest = () => {
    const csv = [
      'id,floor,area,timestamp,synced',
      ...photos.map((p) => `${p.id},${p.floor},${p.area},${p.timestamp},${p.synced}`),
    ].join('\n');
    Alert.alert(
      'Export Ready',
      `CSV manifest for ${photos.length} photos generated.\n\nIn production this exports a ZIP file + CSV to your job folder.\n\nSample:\n${csv.slice(0, 200)}…`,
      [{ text: 'OK' }]
    );
  };

  const unsynced   = photos.filter((p) => !p.synced).length;
  const byFloor    = FLOORS.map((f) => ({ floor: f, count: photos.filter((p) => p.floor === f).length })).filter((x) => x.count > 0);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* Header */}
      <LinearGradient colors={['#7c3aed', '#6d28d9']} style={styles.header}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.headerTitle}>Large Loss</Text>
            <Text style={styles.headerSub}>Rapid Multi-Floor Documentation</Text>
          </View>
          <View style={styles.headerStats}>
            <Text style={styles.headerStatNum}>{photos.length}</Text>
            <Text style={styles.headerStatLabel}>photos</Text>
          </View>
        </View>

        {/* Sync bar */}
        {unsynced > 0 && (
          <TouchableOpacity style={styles.syncBar} onPress={syncPhotos} disabled={syncing}>
            {syncing
              ? <ActivityIndicator size="small" color="#fff" />
              : <Ionicons name="cloud-upload-outline" size={16} color="#fff" />
            }
            <Text style={styles.syncBarText}>
              {syncing ? 'Uploading…' : `${unsynced} photo${unsynced !== 1 ? 's' : ''} pending sync — tap to upload`}
            </Text>
          </TouchableOpacity>
        )}
      </LinearGradient>

      <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent} showsVerticalScrollIndicator={false}>

        {/* Floor selector */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Floor / Level</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {FLOORS.map((floor) => (
                <TouchableOpacity
                  key={floor}
                  style={[styles.chip, activeFloor === floor && styles.chipActive]}
                  onPress={() => setActiveFloor(floor)}
                >
                  <Text style={[styles.chipText, activeFloor === floor && styles.chipTextActive]}>
                    {floor}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        </View>

        {/* Area selector */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Area / Category</Text>
          <View style={styles.areaGrid}>
            {AREAS.map((area) => (
              <TouchableOpacity
                key={area}
                style={[styles.areaChip, activeArea === area && styles.areaChipActive]}
                onPress={() => setActiveArea(area)}
              >
                <Text style={[styles.areaChipText, activeArea === area && styles.areaChipTextActive]}>
                  {area}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Capture buttons */}
        <View style={styles.captureRow}>
          <TouchableOpacity
            style={[styles.captureBtn, styles.capturePrimary]}
            onPress={capturePhoto}
            disabled={capturing}
            activeOpacity={0.85}
          >
            {capturing
              ? <ActivityIndicator size="small" color="#fff" />
              : <Ionicons name="camera" size={24} color="#fff" />
            }
            <Text style={styles.captureBtnText}>
              {capturing ? 'Capturing…' : 'Capture'}
            </Text>
            {!capturing && (
              <View style={styles.captureContext}>
                <Text style={styles.captureContextText}>{activeFloor} · {activeArea}</Text>
              </View>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.captureBtn, styles.captureSecondary]}
            onPress={importPhotos}
            activeOpacity={0.85}
          >
            <Ionicons name="images" size={22} color="#fff" />
            <Text style={styles.captureBtnText}>Import</Text>
          </TouchableOpacity>
        </View>

        {/* Floor breakdown stats */}
        {byFloor.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Photos by Floor</Text>
            <View style={styles.floorStats}>
              {byFloor.map(({ floor, count }) => (
                <View key={floor} style={styles.floorStatRow}>
                  <Ionicons name="layers-outline" size={14} color={Colors.textMuted} />
                  <Text style={styles.floorStatName}>{floor}</Text>
                  <View style={styles.floorStatBar}>
                    <View
                      style={[styles.floorStatFill, { width: `${(count / photos.length) * 100}%` }]}
                    />
                  </View>
                  <Text style={styles.floorStatCount}>{count}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Photo grid */}
        {photos.length > 0 ? (
          <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>Captured Photos ({photos.length})</Text>
              <TouchableOpacity onPress={exportManifest}>
                <Text style={styles.exportLink}>Export CSV</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.grid}>
              {photos.map((photo) => (
                <PhotoThumb key={photo.id} photo={photo} />
              ))}
            </View>
          </View>
        ) : (
          <View style={styles.emptyBox}>
            <Ionicons name="business-outline" size={48} color={Colors.textMuted} />
            <Text style={styles.emptyTitle}>Ready to document</Text>
            <Text style={styles.emptyText}>
              Select a floor and area, then tap Capture for rapid photo documentation.
              All photos are tagged and organised automatically.
            </Text>
          </View>
        )}

        {/* Export / sync actions */}
        {photos.length > 0 && (
          <View style={styles.actionRow}>
            <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#7c3aed' }]} onPress={syncPhotos} disabled={syncing}>
              {syncing
                ? <ActivityIndicator size="small" color="#fff" />
                : <Ionicons name="cloud-upload-outline" size={18} color="#fff" />
              }
              <Text style={styles.actionBtnText}>{syncing ? 'Syncing…' : 'Sync All'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.actionBtn, { backgroundColor: Colors.navy }]} onPress={exportManifest}>
              <Ionicons name="download-outline" size={18} color="#fff" />
              <Text style={styles.actionBtnText}>Export ZIP</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },

  header: {
    paddingTop: Platform.OS === 'ios' ? 56 : 40,
    paddingHorizontal: Spacing.md, paddingBottom: Spacing.md,
  },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
  headerTitle: { fontSize: FontSize.xxl, fontWeight: '800', color: '#fff' },
  headerSub: { fontSize: FontSize.xs, color: 'rgba(255,255,255,0.65)', marginTop: 3, letterSpacing: 0.8 },
  headerStats: { alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 12, padding: 10 },
  headerStatNum: { fontSize: FontSize.xl, fontWeight: '800', color: '#fff' },
  headerStatLabel: { fontSize: FontSize.xs, color: 'rgba(255,255,255,0.7)' },

  syncBar: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: Radius.sm,
    paddingHorizontal: 12, paddingVertical: 8,
  },
  syncBarText: { fontSize: FontSize.xs, color: '#fff', fontWeight: '600', flex: 1 },

  body: { flex: 1 },
  bodyContent: { padding: Spacing.md, paddingBottom: 50 },

  section: { marginBottom: Spacing.lg },
  sectionTitle: {
    fontSize: FontSize.xs, fontWeight: '700', color: Colors.textPrimary,
    textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: Spacing.sm,
  },
  sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.sm },
  exportLink: { fontSize: FontSize.xs, fontWeight: '700', color: '#7c3aed' },

  chip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: Radius.full,
    backgroundColor: Colors.card, borderWidth: 1.5, borderColor: Colors.border,
  },
  chipActive: { backgroundColor: Colors.navy, borderColor: Colors.navy },
  chipText: { fontSize: FontSize.xs, fontWeight: '600', color: Colors.textSecondary },
  chipTextActive: { color: '#fff' },

  areaGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  areaChip: {
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: Radius.md,
    backgroundColor: Colors.card, borderWidth: 1.5, borderColor: Colors.border,
  },
  areaChipActive: { backgroundColor: '#7c3aed', borderColor: '#7c3aed' },
  areaChipText: { fontSize: FontSize.xs, fontWeight: '600', color: Colors.textSecondary },
  areaChipTextActive: { color: '#fff' },

  captureRow: { flexDirection: 'row', gap: 10, marginBottom: Spacing.lg },
  captureBtn: {
    flex: 1, borderRadius: Radius.md, padding: 16,
    alignItems: 'center', justifyContent: 'center', gap: 6, ...Shadow.md,
  },
  capturePrimary: { backgroundColor: '#7c3aed', flex: 2 },
  captureSecondary: { backgroundColor: Colors.navy },
  captureBtnText: { fontSize: FontSize.sm, fontWeight: '800', color: '#fff' },
  captureContext: {
    backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: Radius.full,
    paddingHorizontal: 8, paddingVertical: 2,
  },
  captureContextText: { fontSize: 10, color: '#fff', fontWeight: '600' },

  floorStats: {
    backgroundColor: Colors.card, borderRadius: Radius.md, padding: Spacing.md, ...Shadow.sm,
  },
  floorStatRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  floorStatName: { fontSize: FontSize.xs, fontWeight: '600', color: Colors.textSecondary, width: 90 },
  floorStatBar: {
    flex: 1, height: 6, backgroundColor: Colors.border, borderRadius: 3, overflow: 'hidden',
  },
  floorStatFill: { height: '100%', backgroundColor: '#7c3aed', borderRadius: 3 },
  floorStatCount: { fontSize: FontSize.xs, fontWeight: '700', color: Colors.textPrimary, width: 20, textAlign: 'right' },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  thumb: { width: '31%', aspectRatio: 1, borderRadius: Radius.md, overflow: 'hidden', ...Shadow.sm },
  thumbImg: { width: '100%', height: '100%' },
  thumbOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 5, backgroundColor: 'rgba(0,0,0,0.35)',
  },
  thumbFloor: { fontSize: 9, fontWeight: '700', color: '#fff' },
  thumbArea: {
    position: 'absolute', bottom: 4, left: 5,
    fontSize: 9, color: 'rgba(255,255,255,0.8)', fontWeight: '600',
  },

  emptyBox: {
    alignItems: 'center', paddingVertical: Spacing.xl,
    backgroundColor: Colors.card, borderRadius: Radius.lg, ...Shadow.sm,
  },
  emptyTitle: { fontSize: FontSize.md, fontWeight: '700', color: Colors.textPrimary, marginTop: 14 },
  emptyText: {
    fontSize: FontSize.sm, color: Colors.textMuted, textAlign: 'center',
    marginTop: 8, paddingHorizontal: 28, lineHeight: 20,
  },

  actionRow: { flexDirection: 'row', gap: 10 },
  actionBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 7, padding: 13, borderRadius: Radius.md, ...Shadow.sm,
  },
  actionBtnText: { fontSize: FontSize.sm, fontWeight: '700', color: '#fff' },
});
