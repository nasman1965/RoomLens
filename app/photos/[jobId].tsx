import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, Alert, Image, ScrollView,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useAuthStore } from '../../src/store';
import { photosService, Photo } from '../../src/services/photos';
import { jobsService } from '../../src/services/jobs';
import { Colors, FontSize, Spacing, Radius, Shadow } from '../../src/constants/theme';

const DAMAGE_TAGS = [
  { value: 'pre_existing', label: 'Before',       emoji: '📷' },
  { value: 'water',        label: 'Water Damage',  emoji: '💧' },
  { value: 'fire',         label: 'Fire Damage',   emoji: '🔥' },
  { value: 'mold',         label: 'Mold',          emoji: '🟢' },
  { value: 'structural',   label: 'Structural',    emoji: '🏗️' },
  { value: 'evidence',     label: 'Evidence',      emoji: '🔍' },
];

const DEFAULT_ROOMS = [
  'Basement', 'Main Floor', 'Upper Floor', 'Kitchen',
  'Bathroom', 'Bedroom', 'Living Room', 'Garage', 'Exterior',
];

export default function PhotosScreen() {
  const { jobId } = useLocalSearchParams<{ jobId: string }>();
  const router = useRouter();
  const { user } = useAuthStore();

  const [photos, setPhotos]           = useState<Photo[]>([]);
  const [loading, setLoading]         = useState(true);
  const [uploading, setUploading]     = useState(false);
  const [selectedRoom, setSelectedRoom] = useState('');
  const [selectedDamage, setSelectedDamage] = useState('');
  const [rooms, setRooms]             = useState<string[]>([]);
  const [jobName, setJobName]         = useState('');
  const [lightbox, setLightbox]       = useState<Photo | null>(null);

  const loadData = useCallback(async () => {
    if (!jobId) return;
    setLoading(true);

    // Load job name
    const { job } = await jobsService.getJob(jobId);
    if (job) setJobName(job.insured_name || job.property_address);

    // Load photos
    const { photos: loaded } = await photosService.getPhotos(jobId);
    setPhotos(loaded);

    // Derive rooms from existing tags
    const existingRooms = Array.from(
      new Set(loaded.map(p => p.room_tag).filter(Boolean) as string[])
    );
    setRooms(existingRooms);
    setLoading(false);
  }, [jobId]);

  useEffect(() => { loadData(); }, [loadData]);

  const pickAndUpload = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Allow photo library access to upload photos.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 0.85,
    });

    if (result.canceled || !result.assets.length) return;

    setUploading(true);
    let uploaded = 0;

    for (const asset of result.assets) {
      const { photo, error } = await photosService.uploadPhoto(
        jobId!,
        user!.id,
        asset.uri,
        selectedRoom || undefined,
        selectedDamage || undefined,
      );
      if (photo) {
        setPhotos(prev => [photo, ...prev]);
        if (selectedRoom && !rooms.includes(selectedRoom)) {
          setRooms(prev => [...prev, selectedRoom]);
        }
        uploaded++;
      } else {
        Alert.alert('Upload Error', error ?? 'Failed to upload photo');
      }
    }

    setUploading(false);
    if (uploaded > 0) {
      Alert.alert('✅ Done', `${uploaded} photo${uploaded > 1 ? 's' : ''} uploaded!`);
    }
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Allow camera access to take photos.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.9,
    });

    if (result.canceled || !result.assets[0]) return;

    setUploading(true);
    const { photo, error } = await photosService.uploadPhoto(
      jobId!,
      user!.id,
      result.assets[0].uri,
      selectedRoom || undefined,
      selectedDamage || undefined,
    );
    setUploading(false);

    if (photo) {
      setPhotos(prev => [photo, ...prev]);
      if (selectedRoom && !rooms.includes(selectedRoom)) {
        setRooms(prev => [...prev, selectedRoom]);
      }
      Alert.alert('✅ Photo saved!', `Tagged: ${selectedRoom || 'Unassigned'}`);
    } else {
      Alert.alert('Error', error ?? 'Upload failed');
    }
  };

  const deletePhoto = async (photo: Photo) => {
    Alert.alert('Delete Photo', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          await photosService.deletePhoto(photo);
          setPhotos(prev => prev.filter(p => p.id !== photo.id));
          if (lightbox?.id === photo.id) setLightbox(null);
        },
      },
    ]);
  };

  if (loading) return (
    <View style={styles.center}>
      <ActivityIndicator size="large" color={Colors.navy} />
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={Colors.textPrimary} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>📸 Photos</Text>
          <Text style={styles.subtitle}>{jobName} · {photos.length} photos</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>

        {/* Tag Panel */}
        <View style={styles.tagPanel}>
          <Text style={styles.sectionLabel}>Damage Type</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}>
            <View style={styles.chipRow}>
              {DAMAGE_TAGS.map(t => (
                <TouchableOpacity
                  key={t.value}
                  style={[styles.chip, selectedDamage === t.value && styles.chipActive]}
                  onPress={() => setSelectedDamage(selectedDamage === t.value ? '' : t.value)}
                >
                  <Text style={[styles.chipText, selectedDamage === t.value && styles.chipTextActive]}>
                    {t.emoji} {t.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>

          <Text style={styles.sectionLabel}>Room</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.chipRow}>
              {[...new Set([...DEFAULT_ROOMS, ...rooms])].map(r => (
                <TouchableOpacity
                  key={r}
                  style={[styles.chip, selectedRoom === r && styles.chipRoomActive]}
                  onPress={() => setSelectedRoom(selectedRoom === r ? '' : r)}
                >
                  <Text style={[styles.chipText, selectedRoom === r && styles.chipTextActive]}>
                    🏠 {r}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        </View>

        {/* Upload Buttons */}
        <View style={styles.btnRow}>
          <TouchableOpacity
            style={[styles.btnPrimary, uploading && styles.btnDisabled]}
            onPress={takePhoto}
            disabled={uploading}
            activeOpacity={0.8}
          >
            {uploading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Ionicons name="camera" size={20} color="#fff" />
            )}
            <Text style={styles.btnText}>{uploading ? 'Uploading…' : 'Take Photo'}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.btnSecondary, uploading && styles.btnDisabled]}
            onPress={pickAndUpload}
            disabled={uploading}
            activeOpacity={0.8}
          >
            <Ionicons name="images" size={20} color={Colors.navy} />
            <Text style={styles.btnSecondaryText}>Gallery</Text>
          </TouchableOpacity>
        </View>

        {/* Photos Grid */}
        {photos.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="camera-outline" size={52} color={Colors.textMuted} />
            <Text style={styles.emptyTitle}>No photos yet</Text>
            <Text style={styles.emptyText}>Take a photo or upload from gallery</Text>
          </View>
        ) : (
          <View style={styles.grid}>
            {photos.map(photo => (
              <TouchableOpacity
                key={photo.id}
                style={styles.thumb}
                onPress={() => setLightbox(photo)}
                onLongPress={() => deletePhoto(photo)}
                activeOpacity={0.85}
              >
                <Image
                  source={{ uri: photo.signedUrl ?? photo.photo_url }}
                  style={styles.thumbImage}
                  resizeMode="cover"
                />
                {photo.room_tag ? (
                  <View style={styles.thumbTag}>
                    <Text style={styles.thumbTagText} numberOfLines={1}>{photo.room_tag}</Text>
                  </View>
                ) : null}
                {photo.damage_tag ? (
                  <View style={styles.thumbDmgTag}>
                    <Text style={styles.thumbTagText}>
                      {DAMAGE_TAGS.find(t => t.value === photo.damage_tag)?.emoji ?? '📷'}
                    </Text>
                  </View>
                ) : null}
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Lightbox */}
      {lightbox ? (
        <TouchableOpacity style={styles.lightbox} onPress={() => setLightbox(null)} activeOpacity={1}>
          <Image
            source={{ uri: lightbox.signedUrl ?? lightbox.photo_url }}
            style={styles.lightboxImage}
            resizeMode="contain"
          />
          <View style={styles.lightboxFooter}>
            {lightbox.room_tag ? <Text style={styles.lightboxTag}>🏠 {lightbox.room_tag}</Text> : null}
            {lightbox.damage_tag ? (
              <Text style={styles.lightboxTag}>
                {DAMAGE_TAGS.find(t => t.value === lightbox.damage_tag)?.emoji}{' '}
                {DAMAGE_TAGS.find(t => t.value === lightbox.damage_tag)?.label}
              </Text>
            ) : null}
            <TouchableOpacity onPress={() => deletePhoto(lightbox)} style={styles.lightboxDelete}>
              <Ionicons name="trash" size={20} color="#fff" />
              <Text style={styles.lightboxDeleteText}>Delete</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container:       { flex: 1, backgroundColor: Colors.background },
  center:          { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header:          { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.lg, paddingTop: 56, paddingBottom: Spacing.md, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: Colors.border },
  backBtn:         { marginRight: Spacing.md },
  title:           { fontSize: FontSize.lg, fontWeight: '700', color: Colors.textPrimary },
  subtitle:        { fontSize: FontSize.xs, color: Colors.textMuted },
  scroll:          { padding: Spacing.lg, paddingBottom: 40 },
  tagPanel:        { backgroundColor: '#fff', borderRadius: Radius.lg, padding: Spacing.md, marginBottom: Spacing.md, borderWidth: 1, borderColor: Colors.border },
  sectionLabel:    { fontSize: FontSize.xs, fontWeight: '700', color: Colors.textSecondary, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  chipRow:         { flexDirection: 'row', gap: 8, paddingRight: 8 },
  chip:            { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, borderWidth: 1, borderColor: Colors.border, backgroundColor: '#f8f9fc' },
  chipActive:      { backgroundColor: Colors.navy, borderColor: Colors.navy },
  chipRoomActive:  { backgroundColor: '#7c3aed', borderColor: '#7c3aed' },
  chipText:        { fontSize: 12, color: Colors.textSecondary, fontWeight: '500' },
  chipTextActive:  { color: '#fff' },
  btnRow:          { flexDirection: 'row', gap: 12, marginBottom: Spacing.lg },
  btnPrimary:      { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: Colors.navy, borderRadius: Radius.md, paddingVertical: 14 },
  btnSecondary:    { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#fff', borderRadius: Radius.md, paddingVertical: 14, borderWidth: 1, borderColor: Colors.border },
  btnDisabled:     { opacity: 0.5 },
  btnText:         { fontSize: FontSize.sm, fontWeight: '700', color: '#fff' },
  btnSecondaryText: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.navy },
  empty:           { alignItems: 'center', paddingVertical: 48 },
  emptyTitle:      { fontSize: FontSize.lg, fontWeight: '600', color: Colors.textPrimary, marginTop: 12 },
  emptyText:       { fontSize: FontSize.sm, color: Colors.textMuted, marginTop: 4 },
  grid:            { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  thumb:           { width: '32.5%', aspectRatio: 1, borderRadius: Radius.sm, overflow: 'hidden', backgroundColor: '#e2e8f0' },
  thumbImage:      { width: '100%', height: '100%' },
  thumbTag:        { position: 'absolute', bottom: 2, left: 2, backgroundColor: 'rgba(124,58,237,0.85)', borderRadius: 4, paddingHorizontal: 4, paddingVertical: 1, maxWidth: '90%' },
  thumbDmgTag:     { position: 'absolute', top: 2, right: 2, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 4, padding: 2 },
  thumbTagText:    { fontSize: 9, color: '#fff', fontWeight: '700' },
  lightbox:        { position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.92)', justifyContent: 'center', alignItems: 'center' },
  lightboxImage:   { width: '100%', height: '75%' },
  lightboxFooter:  { position: 'absolute', bottom: 40, left: 20, right: 20, flexDirection: 'row', gap: 8, alignItems: 'center', flexWrap: 'wrap' },
  lightboxTag:     { backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 , color: '#fff', fontSize: 13, fontWeight: '600' },
  lightboxDelete:  { marginLeft: 'auto', flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#ef4444', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 },
  lightboxDeleteText: { color: '#fff', fontWeight: '700', fontSize: 13 },
});
