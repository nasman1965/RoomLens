import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, StatusBar,
  TouchableOpacity, Alert, Image, Modal, FlatList, ActivityIndicator,
  Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Colors, FontSize, Spacing, Radius, Shadow } from '../../src/constants/theme';
import { DamagePhoto, AIPhotoAnalysis, XactimateLineItem } from '../../src/types';

// ─── Damage tag config ────────────────────────────────────────────────────────
const DAMAGE_TAGS: Array<{ value: DamagePhoto['damage_tag']; label: string; color: string }> = [
  { value: 'water',       label: 'Water Damage',    color: '#3b82f6' },
  { value: 'fire',        label: 'Fire Damage',     color: '#ef4444' },
  { value: 'mold',        label: 'Mold',            color: '#22c55e' },
  { value: 'structural',  label: 'Structural',      color: '#8b5cf6' },
  { value: 'pre_existing',label: 'Pre-existing',    color: '#94a3b8' },
];

// ─── Fake AI analysis for UI demo ─────────────────────────────────────────────
const fakeAIAnalysis = (damage: DamagePhoto['damage_tag']): AIPhotoAnalysis => ({
  material_type: 'Drywall',
  damage_type: damage === 'water' ? 'Water intrusion' : damage === 'fire' ? 'Char/soot' : 'Mold growth',
  severity: 'moderate',
  confidence: 0.87,
  xactimate_line_items: [
    { code: 'DRY-3', description: 'Drywall removal & disposal', unit: 'SF', estimated_quantity: 120, selected: true },
    { code: 'INS-1', description: 'Insulation — blown in', unit: 'SF', estimated_quantity: 120, selected: true },
    { code: 'P-DTX', description: 'Prime & paint — 2 coats', unit: 'SF', estimated_quantity: 120, selected: false },
  ],
});

// ─── Photo Tile ───────────────────────────────────────────────────────────────
function PhotoTile({ photo, onPress }: { photo: DamagePhoto; onPress: () => void }) {
  const tagInfo = DAMAGE_TAGS.find((t) => t.value === photo.damage_tag);
  return (
    <TouchableOpacity style={styles.photoTile} onPress={onPress} activeOpacity={0.85}>
      <Image source={{ uri: photo.photo_url }} style={styles.photoImg} resizeMode="cover" />
      <View style={styles.photoOverlay}>
        {tagInfo && (
          <View style={[styles.photoTag, { backgroundColor: tagInfo.color }]}>
            <Text style={styles.photoTagText}>{tagInfo.label}</Text>
          </View>
        )}
        {photo.ai_analysis_json ? (
          <View style={styles.photoAiBadge}>
            <Ionicons name="sparkles" size={10} color="#fff" />
            <Text style={styles.photoAiText}>AI</Text>
          </View>
        ) : null}
      </View>
    </TouchableOpacity>
  );
}

// ─── Xactimate Line Item Row ──────────────────────────────────────────────────
function LineItemRow({
  item, onToggle,
}: { item: XactimateLineItem; onToggle: () => void }) {
  return (
    <TouchableOpacity style={[styles.lineItemRow, item.selected && styles.lineItemSelected]} onPress={onToggle}>
      <View style={[styles.lineItemCheck, item.selected && styles.lineItemCheckActive]}>
        {item.selected && <Ionicons name="checkmark" size={12} color="#fff" />}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.lineItemCode}>{item.code}</Text>
        <Text style={styles.lineItemDesc}>{item.description}</Text>
      </View>
      <View style={styles.lineItemQty}>
        <Text style={styles.lineItemQtyNum}>{item.estimated_quantity}</Text>
        <Text style={styles.lineItemQtyUnit}>{item.unit}</Text>
      </View>
    </TouchableOpacity>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function PhotosScreen() {
  const { jobId } = useLocalSearchParams<{ jobId: string }>();
  const router = useRouter();

  const [photos, setPhotos] = useState<DamagePhoto[]>([]);
  const [selectedDamageTag, setSelectedDamageTag] = useState<DamagePhoto['damage_tag']>('water');
  const [selectedPhoto, setSelectedPhoto] = useState<DamagePhoto | null>(null);
  const [analysing, setAnalysing] = useState(false);
  const [showDetail, setShowDetail] = useState(false);

  // ── Capture / Select photos ────────────────────────────────────────────────
  const capturePhoto = async (source: 'camera' | 'library') => {
    const launchFn = source === 'camera'
      ? ImagePicker.launchCameraAsync
      : ImagePicker.launchImageLibraryAsync;

    const { status } = await (source === 'camera'
      ? ImagePicker.requestCameraPermissionsAsync()
      : ImagePicker.requestMediaLibraryPermissionsAsync());

    if (status !== 'granted') {
      Alert.alert('Permission Needed', `${source === 'camera' ? 'Camera' : 'Photo library'} access is required.`);
      return;
    }

    const result = await launchFn({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.85,
      allowsMultipleSelection: source === 'library',
    });

    if (!result.canceled && result.assets) {
      const newPhotos: DamagePhoto[] = result.assets.map((asset) => ({
        id: `p${Date.now()}-${Math.random().toString(36).slice(2)}`,
        job_id: jobId!,
        photo_url: asset.uri,
        damage_tag: selectedDamageTag,
        timestamp: new Date().toISOString(),
      }));
      setPhotos((prev) => [...newPhotos, ...prev]);
    }
  };

  // ── Run AI analysis on a photo ─────────────────────────────────────────────
  const runAIAnalysis = async (photo: DamagePhoto) => {
    setAnalysing(true);
    // Simulate API call to GPT-4o Vision (real: POST to AWS Lambda)
    await new Promise((r) => setTimeout(r, 2000));
    const analysis = fakeAIAnalysis(photo.damage_tag);
    const updated = { ...photo, ai_analysis_json: analysis };
    setPhotos((prev) => prev.map((p) => p.id === photo.id ? updated : p));
    setSelectedPhoto(updated);
    setAnalysing(false);
  };

  const toggleLineItem = (photo: DamagePhoto, index: number) => {
    const analysis = photo.ai_analysis_json;
    if (!analysis) return;
    const updatedItems = analysis.xactimate_line_items.map((item, i) =>
      i === index ? { ...item, selected: !item.selected } : item
    );
    const updatedAnalysis = { ...analysis, xactimate_line_items: updatedItems };
    const updatedPhoto = { ...photo, ai_analysis_json: updatedAnalysis };
    setPhotos((prev) => prev.map((p) => p.id === photo.id ? updatedPhoto : p));
    setSelectedPhoto(updatedPhoto);
  };

  const deletePhoto = (photoId: string) => {
    Alert.alert('Delete Photo', 'Remove this photo?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: () => {
          setPhotos((prev) => prev.filter((p) => p.id !== photoId));
          setShowDetail(false);
        },
      },
    ]);
  };

  const severityColor = (s?: string) => s === 'severe' ? Colors.error : s === 'moderate' ? Colors.warning : Colors.success;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={22} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Damage Photos</Text>
        <Text style={styles.headerCount}>{photos.length}</Text>
      </View>

      <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>

        {/* Damage tag filter */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Damage Type</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {DAMAGE_TAGS.map((tag) => (
                <TouchableOpacity
                  key={tag.value}
                  style={[styles.tagChip, selectedDamageTag === tag.value && { backgroundColor: tag.color, borderColor: tag.color }]}
                  onPress={() => setSelectedDamageTag(tag.value)}
                >
                  <Text style={[styles.tagChipText, selectedDamageTag === tag.value && { color: '#fff' }]}>
                    {tag.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        </View>

        {/* Capture buttons */}
        <View style={styles.captureRow}>
          <TouchableOpacity style={[styles.captureBtn, { backgroundColor: Colors.navy }]} onPress={() => capturePhoto('camera')} activeOpacity={0.85}>
            <Ionicons name="camera" size={20} color="#fff" />
            <Text style={styles.captureBtnText}>Camera</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.captureBtn, { backgroundColor: Colors.navyLight }]} onPress={() => capturePhoto('library')} activeOpacity={0.85}>
            <Ionicons name="images" size={20} color="#fff" />
            <Text style={styles.captureBtnText}>Library</Text>
          </TouchableOpacity>
        </View>

        {/* Photo grid */}
        {photos.length === 0 ? (
          <View style={styles.emptyBox}>
            <Ionicons name="camera-outline" size={52} color={Colors.textMuted} />
            <Text style={styles.emptyTitle}>No photos yet</Text>
            <Text style={styles.emptyText}>Select a damage type and tap Camera or Library to add photos</Text>
          </View>
        ) : (
          <View style={styles.photoGrid}>
            {photos.map((photo) => (
              <PhotoTile
                key={photo.id}
                photo={photo}
                onPress={() => { setSelectedPhoto(photo); setShowDetail(true); }}
              />
            ))}
          </View>
        )}

        {/* AI Batch Analyse button */}
        {photos.filter((p) => !p.ai_analysis_json).length > 0 && (
          <TouchableOpacity
            style={styles.aiBtn}
            onPress={() => {
              const first = photos.find((p) => !p.ai_analysis_json);
              if (first) { setSelectedPhoto(first); setShowDetail(true); }
            }}
            activeOpacity={0.9}
          >
            <Ionicons name="sparkles" size={20} color="#fff" />
            <Text style={styles.aiBtnText}>
              AI Analyse {photos.filter((p) => !p.ai_analysis_json).length} Photo{photos.filter((p) => !p.ai_analysis_json).length !== 1 ? 's' : ''}
            </Text>
          </TouchableOpacity>
        )}
      </ScrollView>

      {/* ── Photo Detail Modal ──────────────────────────────────────────────────── */}
      <Modal
        visible={showDetail && !!selectedPhoto}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowDetail(false)}
      >
        {selectedPhoto && (
          <View style={styles.detailContainer}>
            {/* Modal header */}
            <View style={styles.detailHeader}>
              <TouchableOpacity onPress={() => setShowDetail(false)} style={styles.backBtn}>
                <Ionicons name="close" size={22} color={Colors.textPrimary} />
              </TouchableOpacity>
              <Text style={styles.detailHeaderTitle}>Photo Detail</Text>
              <TouchableOpacity onPress={() => deletePhoto(selectedPhoto.id)} style={styles.deleteBtn}>
                <Ionicons name="trash-outline" size={18} color={Colors.error} />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={{ paddingBottom: 50 }}>
              {/* Image */}
              <Image source={{ uri: selectedPhoto.photo_url }} style={styles.detailImage} resizeMode="cover" />

              <View style={{ padding: Spacing.md }}>
                {/* AI Analysis section */}
                {!selectedPhoto.ai_analysis_json ? (
                  <TouchableOpacity
                    style={styles.runAiBtn}
                    onPress={() => runAIAnalysis(selectedPhoto)}
                    disabled={analysing}
                  >
                    {analysing ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Ionicons name="sparkles" size={20} color="#fff" />
                    )}
                    <Text style={styles.runAiBtnText}>
                      {analysing ? 'Analysing with GPT-4o Vision…' : 'Run AI Damage Analysis'}
                    </Text>
                  </TouchableOpacity>
                ) : (
                  <View>
                    {/* Analysis result */}
                    <View style={styles.analysisCard}>
                      <View style={styles.analysisHeader}>
                        <Ionicons name="sparkles" size={16} color={Colors.tileEstimate} />
                        <Text style={styles.analysisTitle}>AI Analysis Result</Text>
                        <View style={[styles.confidenceBadge]}>
                          <Text style={styles.confidenceText}>
                            {Math.round((selectedPhoto.ai_analysis_json.confidence ?? 0) * 100)}% confident
                          </Text>
                        </View>
                      </View>

                      <View style={styles.analysisRow}>
                        <Text style={styles.analysisLabel}>Material:</Text>
                        <Text style={styles.analysisValue}>{selectedPhoto.ai_analysis_json.material_type}</Text>
                      </View>
                      <View style={styles.analysisRow}>
                        <Text style={styles.analysisLabel}>Damage:</Text>
                        <Text style={styles.analysisValue}>{selectedPhoto.ai_analysis_json.damage_type}</Text>
                      </View>
                      <View style={styles.analysisRow}>
                        <Text style={styles.analysisLabel}>Severity:</Text>
                        <Text style={[styles.analysisValue, { color: severityColor(selectedPhoto.ai_analysis_json.severity), fontWeight: '700', textTransform: 'uppercase' }]}>
                          {selectedPhoto.ai_analysis_json.severity}
                        </Text>
                      </View>
                    </View>

                    {/* Xactimate line items */}
                    <Text style={[styles.sectionTitle, { marginTop: Spacing.md, marginBottom: 8 }]}>
                      Suggested Xactimate Items
                    </Text>
                    {selectedPhoto.ai_analysis_json.xactimate_line_items.map((item, i) => (
                      <LineItemRow
                        key={i}
                        item={item}
                        onToggle={() => toggleLineItem(selectedPhoto, i)}
                      />
                    ))}

                    <TouchableOpacity style={styles.addToEstimateBtn}>
                      <Ionicons name="add-circle-outline" size={18} color="#fff" />
                      <Text style={styles.addToEstimateText}>
                        Add {selectedPhoto.ai_analysis_json.xactimate_line_items.filter((i) => i.selected).length} Items to Estimate
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            </ScrollView>
          </View>
        )}
      </Modal>
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
  backBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: Colors.background, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: FontSize.lg, fontWeight: '800', color: Colors.textPrimary },
  headerCount: {
    width: 30, height: 30, borderRadius: 15, backgroundColor: Colors.red,
    textAlign: 'center', lineHeight: 30, fontSize: FontSize.sm, fontWeight: '700', color: '#fff',
  },
  body: { flex: 1 },
  bodyContent: { padding: Spacing.md, paddingBottom: 50 },
  section: { marginBottom: Spacing.lg },
  sectionTitle: { fontSize: FontSize.xs, fontWeight: '700', color: Colors.textPrimary, textTransform: 'uppercase', letterSpacing: 0.5 },

  // Tags
  tagChip: {
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: Radius.full,
    borderWidth: 1.5, borderColor: Colors.border, backgroundColor: Colors.card,
  },
  tagChipText: { fontSize: FontSize.xs, fontWeight: '600', color: Colors.textSecondary },

  // Capture
  captureRow: { flexDirection: 'row', gap: 10, marginBottom: Spacing.md },
  captureBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, padding: 14, borderRadius: Radius.md, ...Shadow.sm,
  },
  captureBtnText: { fontSize: FontSize.sm, fontWeight: '700', color: '#fff' },

  // Photo grid
  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: Spacing.md },
  photoTile: {
    width: '31%', aspectRatio: 1, borderRadius: Radius.md, overflow: 'hidden',
    ...Shadow.sm,
  },
  photoImg: { width: '100%', height: '100%' },
  photoOverlay: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 4, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  photoTag: { borderRadius: 4, paddingHorizontal: 4, paddingVertical: 2 },
  photoTagText: { fontSize: 8, fontWeight: '700', color: '#fff' },
  photoAiBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 2,
    backgroundColor: Colors.tileEstimate, borderRadius: 4, paddingHorizontal: 4, paddingVertical: 2,
  },
  photoAiText: { fontSize: 8, fontWeight: '700', color: '#fff' },

  emptyBox: { alignItems: 'center', paddingTop: 60, paddingHorizontal: 40 },
  emptyTitle: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.textPrimary, marginTop: 16 },
  emptyText: { fontSize: FontSize.sm, color: Colors.textMuted, textAlign: 'center', marginTop: 8, lineHeight: 20 },

  // AI button
  aiBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 10, backgroundColor: Colors.tileEstimate, borderRadius: Radius.md,
    paddingVertical: 14, marginTop: 8, ...Shadow.md,
  },
  aiBtnText: { fontSize: FontSize.md, fontWeight: '800', color: '#fff' },

  // Detail modal
  detailContainer: { flex: 1, backgroundColor: Colors.background },
  detailHeader: {
    paddingTop: Platform.OS === 'ios' ? 56 : 36,
    paddingHorizontal: Spacing.md, paddingBottom: Spacing.sm,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: Colors.card, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  detailHeaderTitle: { fontSize: FontSize.lg, fontWeight: '800', color: Colors.textPrimary },
  deleteBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: '#fff0f1', justifyContent: 'center', alignItems: 'center' },
  detailImage: { width: '100%', height: 260 },

  // AI analysis
  runAiBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 10, backgroundColor: Colors.tileEstimate, borderRadius: Radius.md,
    paddingVertical: 14, ...Shadow.sm,
  },
  runAiBtnText: { fontSize: FontSize.sm, fontWeight: '700', color: '#fff' },
  analysisCard: {
    backgroundColor: Colors.card, borderRadius: Radius.md, padding: Spacing.md,
    borderLeftWidth: 3, borderLeftColor: Colors.tileEstimate, ...Shadow.sm, marginBottom: Spacing.sm,
  },
  analysisHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  analysisTitle: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.textPrimary, flex: 1 },
  confidenceBadge: {
    backgroundColor: Colors.background, borderRadius: Radius.full,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  confidenceText: { fontSize: 10, fontWeight: '700', color: Colors.textSecondary },
  analysisRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 5 },
  analysisLabel: { fontSize: FontSize.xs, fontWeight: '700', color: Colors.textMuted, width: 65 },
  analysisValue: { fontSize: FontSize.sm, color: Colors.textPrimary, flex: 1 },

  // Line items
  lineItemRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: Colors.card, borderRadius: Radius.sm,
    padding: 10, marginBottom: 6, borderWidth: 1.5, borderColor: Colors.border,
  },
  lineItemSelected: { borderColor: Colors.success, backgroundColor: '#f0fdf4' },
  lineItemCheck: {
    width: 22, height: 22, borderRadius: 6, borderWidth: 2,
    borderColor: Colors.border, justifyContent: 'center', alignItems: 'center',
  },
  lineItemCheckActive: { backgroundColor: Colors.success, borderColor: Colors.success },
  lineItemCode: { fontSize: FontSize.xs, fontWeight: '700', color: Colors.textMuted },
  lineItemDesc: { fontSize: FontSize.sm, color: Colors.textPrimary },
  lineItemQty: { alignItems: 'center' },
  lineItemQtyNum: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.textPrimary },
  lineItemQtyUnit: { fontSize: 9, color: Colors.textMuted },
  addToEstimateBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, backgroundColor: Colors.success, borderRadius: Radius.md,
    paddingVertical: 13, marginTop: Spacing.sm, ...Shadow.sm,
  },
  addToEstimateText: { fontSize: FontSize.sm, fontWeight: '800', color: '#fff' },
});
