import React, { useState, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, StatusBar,
  TouchableOpacity, Alert, FlatList, ActivityIndicator,
  Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Colors, FontSize, Spacing, Radius, Shadow } from '../../src/constants/theme';
import oscCamera from '../../src/services/oscCamera';
import { useCameraStore } from '../../src/store';
import { ROOM_SUGGESTIONS, CAMERA_ENDPOINTS } from '../../src/constants/app';

// ─── Camera type selector ─────────────────────────────────────────────────────
type CameraSource = 'insta360' | 'theta' | 'manual';
type ScanPhase = 'rooms' | 'capture' | 'uploading' | 'processing' | 'result';

interface CapturedRoom {
  id: string;
  name: string;
  photoUri: string | null;
  fileUrl?: string;
  status: 'pending' | 'captured' | 'uploaded';
}

// ─── Room Row ─────────────────────────────────────────────────────────────────
function RoomRow({
  room, index, onCapture, onDelete, onRename, capturing,
}: {
  room: CapturedRoom; index: number;
  onCapture: () => void; onDelete: () => void;
  onRename: (name: string) => void;
  capturing: boolean;
}) {
  return (
    <View style={styles.roomRow}>
      <View style={[styles.roomNum, room.status === 'captured' && styles.roomNumDone]}>
        {room.status === 'captured' ? (
          <Ionicons name="checkmark" size={14} color="#fff" />
        ) : (
          <Text style={styles.roomNumText}>{index + 1}</Text>
        )}
      </View>
      <Text style={styles.roomName} numberOfLines={1}>{room.name}</Text>
      <View style={styles.roomActions}>
        {room.status === 'pending' ? (
          <TouchableOpacity
            style={[styles.roomBtn, styles.roomBtnCapture]}
            onPress={onCapture}
            disabled={capturing}
          >
            {capturing ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Ionicons name="camera-outline" size={16} color="#fff" />
            )}
          </TouchableOpacity>
        ) : (
          <View style={styles.roomCaptured}>
            <Ionicons name="checkmark-circle" size={20} color={Colors.success} />
          </View>
        )}
        <TouchableOpacity onPress={onDelete} style={styles.roomBtnDelete}>
          <Ionicons name="trash-outline" size={15} color={Colors.error} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function FloorPlanScreen() {
  const { jobId } = useLocalSearchParams<{ jobId: string }>();
  const router = useRouter();
  const { camera, setCamera, capturedPhotos, addCapturedPhoto, clearPhotos } = useCameraStore();

  const [phase, setPhase] = useState<ScanPhase>('rooms');
  const [cameraSource, setCameraSource] = useState<CameraSource>('insta360');
  const [rooms, setRooms] = useState<CapturedRoom[]>([
    { id: 'r1', name: 'Living Room', photoUri: null, status: 'pending' },
    { id: 'r2', name: 'Kitchen',     photoUri: null, status: 'pending' },
  ]);
  const [newRoomName, setNewRoomName] = useState('');
  const [connectingCamera, setConnectingCamera] = useState(false);
  const [capturingRoomId, setCapturingRoomId] = useState<string | null>(null);
  const [processingProgress, setProcessingProgress] = useState(0);
  const [floorPlanUrl, setFloorPlanUrl] = useState<string | null>(null);
  const processingTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Connect camera ─────────────────────────────────────────────────────────
  const connectCamera = async () => {
    if (cameraSource === 'manual') {
      setCamera({ connected: true, cameraType: 'manual' });
      return;
    }
    setConnectingCamera(true);
    oscCamera.setCameraType(cameraSource);
    const { connected, info, error } = await oscCamera.checkConnection();
    setConnectingCamera(false);

    if (connected && info) {
      setCamera({
        connected: true,
        cameraType: cameraSource,
        model: info.model,
        ip: cameraSource === 'insta360'
          ? CAMERA_ENDPOINTS.insta360.ip
          : CAMERA_ENDPOINTS.theta.ip,
      });
      Alert.alert('Camera Connected', `${info.model ?? 'Camera'} is ready to capture.`);
    } else {
      Alert.alert(
        'Connection Failed',
        `${error ?? 'Camera not reachable.'}\n\nMake sure you:\n1. Powered on the camera\n2. Connected your phone to the camera's Wi-Fi\n3. Selected the correct camera model`
      );
    }
  };

  // ── Add room ───────────────────────────────────────────────────────────────
  const addRoom = (name: string) => {
    if (!name.trim()) return;
    setRooms((prev) => [
      ...prev,
      { id: `r${Date.now()}`, name: name.trim(), photoUri: null, status: 'pending' },
    ]);
    setNewRoomName('');
  };

  // ── Capture photo for room ─────────────────────────────────────────────────
  const capturePhoto = async (roomId: string) => {
    setCapturingRoomId(roomId);

    try {
      if (cameraSource === 'manual') {
        // Manual: use image picker
        const result = await ImagePicker.launchCameraAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          quality: 0.9,
          allowsEditing: false,
        });
        if (!result.canceled && result.assets?.[0]) {
          const uri = result.assets[0].uri;
          setRooms((prev) =>
            prev.map((r) => r.id === roomId ? { ...r, photoUri: uri, status: 'captured' } : r)
          );
          addCapturedPhoto(uri);
        }
      } else {
        // OSC camera
        if (!camera.connected) {
          Alert.alert('Camera Not Connected', 'Please connect to your 360° camera first.');
          return;
        }
        const result = await oscCamera.takePicture();
        if (result.success && result.fileUrl) {
          setRooms((prev) =>
            prev.map((r) =>
              r.id === roomId ? { ...r, photoUri: result.fileUrl!, fileUrl: result.fileUrl, status: 'captured' } : r
            )
          );
          addCapturedPhoto(result.fileUrl);
        } else {
          Alert.alert('Capture Failed', result.error ?? 'Unknown error');
        }
      }
    } finally {
      setCapturingRoomId(null);
    }
  };

  // ── Upload & Process ───────────────────────────────────────────────────────
  const startProcessing = () => {
    const allCaptured = rooms.every((r) => r.status === 'captured');
    if (!allCaptured) {
      Alert.alert(
        'Missing Photos',
        'Some rooms are still missing photos. Proceed with captured rooms only?',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Proceed', onPress: processFloorPlan },
        ]
      );
    } else {
      processFloorPlan();
    }
  };

  const processFloorPlan = () => {
    setPhase('processing');
    setProcessingProgress(0);

    // Simulate processing progress (real: poll AWS ECS Fargate endpoint)
    processingTimer.current = setInterval(() => {
      setProcessingProgress((prev) => {
        if (prev >= 100) {
          clearInterval(processingTimer.current!);
          setPhase('result');
          setFloorPlanUrl('https://placehold.co/800x600/0a1628/ffffff?text=Floor+Plan+Ready');
          return 100;
        }
        return prev + Math.random() * 12;
      });
    }, 600);
  };

  const capturedCount = rooms.filter((r) => r.status === 'captured').length;

  // ══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════════════════════════════════

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={22} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>360° Floor Plan</Text>
        <View style={{ width: 36 }} />
      </View>

      {/* ── Phase: ROOMS ── */}
      {(phase === 'rooms' || phase === 'capture') && (
        <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent} showsVerticalScrollIndicator={false}>

          {/* Camera Source */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Camera Source</Text>
            <View style={styles.sourceRow}>
              {(['insta360', 'theta', 'manual'] as CameraSource[]).map((src) => {
                const labels = { insta360: 'Insta360 X4', theta: 'Ricoh Theta', manual: 'Manual Upload' };
                const icons = { insta360: 'radio-outline', theta: 'radio-outline', manual: 'cloud-upload-outline' };
                return (
                  <TouchableOpacity
                    key={src}
                    style={[styles.sourceChip, cameraSource === src && styles.sourceChipActive]}
                    onPress={() => { setCameraSource(src); setCamera({ connected: false, cameraType: src }); }}
                  >
                    <Ionicons name={icons[src] as any} size={16} color={cameraSource === src ? '#fff' : Colors.textSecondary} />
                    <Text style={[styles.sourceLabel, cameraSource === src && styles.sourceLabelActive]}>
                      {labels[src]}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Connect button */}
            {cameraSource !== 'manual' && (
              <TouchableOpacity
                style={[styles.connectBtn, camera.connected && styles.connectBtnActive]}
                onPress={connectCamera}
                disabled={connectingCamera}
              >
                {connectingCamera ? (
                  <ActivityIndicator size="small" color={camera.connected ? '#fff' : Colors.navy} />
                ) : (
                  <Ionicons
                    name={camera.connected ? 'checkmark-circle' : 'wifi-outline'}
                    size={18}
                    color={camera.connected ? '#fff' : Colors.navy}
                  />
                )}
                <Text style={[styles.connectText, camera.connected && styles.connectTextActive]}>
                  {connectingCamera ? 'Connecting…' : camera.connected ? `Connected — ${camera.model ?? cameraSource}` : `Connect to ${cameraSource === 'insta360' ? 'Insta360 X4' : 'Ricoh Theta'}`}
                </Text>
              </TouchableOpacity>
            )}

            {cameraSource !== 'manual' && (
              <View style={styles.infoBox}>
                <Ionicons name="information-circle-outline" size={16} color={Colors.info} />
                <Text style={styles.infoText}>
                  Connect to camera Wi-Fi first:{' '}
                  <Text style={{ fontWeight: '700' }}>
                    {cameraSource === 'insta360' ? 'SSID: Insta360... → IP 192.168.42.1' : 'SSID: THETAXX... → IP 192.168.1.1'}
                  </Text>
                </Text>
              </View>
            )}
          </View>

          {/* Rooms */}
          <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>Rooms ({rooms.length})</Text>
              <Text style={styles.capturedCount}>{capturedCount}/{rooms.length} captured</Text>
            </View>

            {rooms.map((room, i) => (
              <RoomRow
                key={room.id}
                room={room}
                index={i}
                capturing={capturingRoomId === room.id}
                onCapture={() => capturePhoto(room.id)}
                onDelete={() => setRooms((prev) => prev.filter((r) => r.id !== room.id))}
                onRename={(name) => setRooms((prev) => prev.map((r) => r.id === room.id ? { ...r, name } : r))}
              />
            ))}

            {/* Add room */}
            <View style={styles.addRoomRow}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.suggestions}>
                {ROOM_SUGGESTIONS.filter((s) => !rooms.some((r) => r.name === s)).slice(0, 8).map((s) => (
                  <TouchableOpacity key={s} style={styles.suggestionChip} onPress={() => addRoom(s)}>
                    <Ionicons name="add" size={12} color={Colors.navy} />
                    <Text style={styles.suggestionText}>{s}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </View>

          {/* Photo guide */}
          <View style={styles.guideCard}>
            <Text style={styles.guideTitle}>📸 Capture Guide</Text>
            {[
              'Place camera at room center, 1.2 m height',
              'One single 360° photo per room',
              'Ensure all walls visible in frame',
              'Avoid moving objects during capture',
            ].map((tip, i) => (
              <View key={i} style={styles.guideTip}>
                <View style={styles.guideDot} />
                <Text style={styles.guideTipText}>{tip}</Text>
              </View>
            ))}
          </View>

          {/* Process button */}
          {capturedCount > 0 && (
            <TouchableOpacity
              style={styles.processBtn}
              onPress={startProcessing}
              activeOpacity={0.9}
            >
              <Ionicons name="arrow-forward-circle" size={22} color="#fff" />
              <Text style={styles.processBtnText}>
                Generate Floor Plan ({capturedCount} room{capturedCount !== 1 ? 's' : ''})
              </Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      )}

      {/* ── Phase: PROCESSING ── */}
      {phase === 'processing' && (
        <View style={styles.processingBox}>
          <View style={styles.processingIcon}>
            <Ionicons name="scan" size={52} color={Colors.tileFloorplan} />
          </View>
          <Text style={styles.processingTitle}>Generating Floor Plan</Text>
          <Text style={styles.processingStep}>
            {processingProgress < 30 ? 'Uploading 360° photos…' :
             processingProgress < 60 ? 'AI analysing room geometry…' :
             processingProgress < 85 ? 'Calculating dimensions…' :
             'Finalising SVG floor plan…'}
          </Text>

          {/* Progress bar */}
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${Math.min(processingProgress, 100)}%` }]} />
          </View>
          <Text style={styles.progressText}>{Math.round(Math.min(processingProgress, 100))}%</Text>

          <Text style={styles.processingEta}>Estimated time: 1-3 minutes</Text>
        </View>
      )}

      {/* ── Phase: RESULT ── */}
      {phase === 'result' && (
        <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
          <View style={styles.resultSuccess}>
            <Ionicons name="checkmark-circle" size={48} color={Colors.success} />
            <Text style={styles.resultTitle}>Floor Plan Ready!</Text>
            <Text style={styles.resultSub}>Dimensioned floor plan generated in under 3 minutes</Text>
          </View>

          {/* Floor plan preview */}
          <View style={styles.floorPlanPreview}>
            <View style={styles.floorPlanPlaceholder}>
              <Ionicons name="map-outline" size={60} color={Colors.textMuted} />
              <Text style={styles.floorPlanPlaceholderText}>Floor Plan SVG Preview</Text>
              <Text style={styles.floorPlanPlaceholderSub}>Connect to Supabase to view generated plan</Text>
            </View>
          </View>

          {/* Room summary */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Captured Rooms</Text>
            {rooms.filter((r) => r.status === 'captured').map((room) => (
              <View key={room.id} style={styles.resultRoom}>
                <Ionicons name="checkmark-circle" size={18} color={Colors.success} />
                <Text style={styles.resultRoomName}>{room.name}</Text>
              </View>
            ))}
          </View>

          {/* Action buttons */}
          <View style={styles.resultActions}>
            <TouchableOpacity style={[styles.actionBtn, { backgroundColor: Colors.tileFloorplan }]}>
              <Ionicons name="download-outline" size={18} color="#fff" />
              <Text style={styles.actionBtnText}>Download PDF</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.actionBtn, { backgroundColor: Colors.success }]}>
              <Ionicons name="share-outline" size={18} color="#fff" />
              <Text style={styles.actionBtnText}>Share</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={styles.processBtn}
            onPress={() => router.back()}
          >
            <Ionicons name="checkmark" size={20} color="#fff" />
            <Text style={styles.processBtnText}>Done — Back to Job</Text>
          </TouchableOpacity>
        </ScrollView>
      )}
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
  body: { flex: 1 },
  bodyContent: { padding: Spacing.md, paddingBottom: 50 },
  section: { marginBottom: Spacing.lg },
  sectionTitle: { fontSize: FontSize.xs, fontWeight: '700', color: Colors.textPrimary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: Spacing.sm },
  sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.sm },
  capturedCount: { fontSize: FontSize.xs, fontWeight: '700', color: Colors.success },

  // Camera source
  sourceRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  sourceChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 9,
    borderRadius: Radius.md, borderWidth: 1.5, borderColor: Colors.border, backgroundColor: Colors.card,
  },
  sourceChipActive: { backgroundColor: Colors.navy, borderColor: Colors.navy },
  sourceLabel: { fontSize: FontSize.xs, fontWeight: '600', color: Colors.textSecondary },
  sourceLabelActive: { color: '#fff' },
  connectBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8, padding: 14,
    borderRadius: Radius.md, borderWidth: 2, borderColor: Colors.navy,
    backgroundColor: Colors.card, marginBottom: 10,
  },
  connectBtnActive: { backgroundColor: Colors.success, borderColor: Colors.success },
  connectText: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.navy, flex: 1 },
  connectTextActive: { color: '#fff' },
  infoBox: {
    flexDirection: 'row', gap: 8, alignItems: 'flex-start',
    backgroundColor: '#eff6ff', borderRadius: Radius.sm, padding: 12,
  },
  infoText: { fontSize: FontSize.xs, color: Colors.textSecondary, flex: 1, lineHeight: 18 },

  // Room rows
  roomRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: Colors.card, borderRadius: Radius.md,
    padding: 12, marginBottom: 8, ...Shadow.sm,
  },
  roomNum: {
    width: 26, height: 26, borderRadius: 8,
    backgroundColor: Colors.background, borderWidth: 1.5, borderColor: Colors.border,
    justifyContent: 'center', alignItems: 'center',
  },
  roomNumDone: { backgroundColor: Colors.success, borderColor: Colors.success },
  roomNumText: { fontSize: FontSize.xs, fontWeight: '700', color: Colors.textSecondary },
  roomName: { flex: 1, fontSize: FontSize.sm, fontWeight: '600', color: Colors.textPrimary },
  roomActions: { flexDirection: 'row', gap: 6 },
  roomBtn: { width: 34, height: 34, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  roomBtnCapture: { backgroundColor: Colors.tileFloorplan },
  roomBtnDelete: { width: 34, height: 34, borderRadius: 10, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff0f1' },
  roomCaptured: { width: 34, height: 34, justifyContent: 'center', alignItems: 'center' },

  // Add room
  addRoomRow: { marginTop: 6 },
  suggestions: { marginTop: 4 },
  suggestionChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: Radius.full,
    backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border,
    marginRight: 6,
  },
  suggestionText: { fontSize: FontSize.xs, fontWeight: '600', color: Colors.navy },

  // Guide card
  guideCard: {
    backgroundColor: '#eff6ff', borderRadius: Radius.md, padding: Spacing.md, marginBottom: Spacing.md,
  },
  guideTitle: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.textPrimary, marginBottom: 10 },
  guideTip: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 6 },
  guideDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.tileFloorplan, marginTop: 5 },
  guideTipText: { fontSize: FontSize.xs, color: Colors.textSecondary, flex: 1, lineHeight: 18 },

  // Process button
  processBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 10, backgroundColor: Colors.red, borderRadius: Radius.md,
    paddingVertical: 16, marginTop: 8, ...Shadow.md,
  },
  processBtnText: { fontSize: FontSize.md, fontWeight: '800', color: '#fff' },

  // Processing phase
  processingBox: {
    flex: 1, justifyContent: 'center', alignItems: 'center',
    padding: Spacing.xl, backgroundColor: Colors.background,
  },
  processingIcon: {
    width: 100, height: 100, borderRadius: 28,
    backgroundColor: `${Colors.tileFloorplan}15`,
    justifyContent: 'center', alignItems: 'center', marginBottom: Spacing.lg,
  },
  processingTitle: { fontSize: FontSize.xl, fontWeight: '800', color: Colors.textPrimary, marginBottom: 8 },
  processingStep: { fontSize: FontSize.sm, color: Colors.textSecondary, marginBottom: Spacing.lg },
  progressBar: {
    width: '90%', height: 8, backgroundColor: Colors.border,
    borderRadius: Radius.full, overflow: 'hidden', marginBottom: 8,
  },
  progressFill: { height: '100%', backgroundColor: Colors.tileFloorplan, borderRadius: Radius.full },
  progressText: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.tileFloorplan, marginBottom: 8 },
  processingEta: { fontSize: FontSize.xs, color: Colors.textMuted },

  // Result phase
  resultSuccess: { alignItems: 'center', marginBottom: Spacing.lg, paddingTop: Spacing.md },
  resultTitle: { fontSize: FontSize.xl, fontWeight: '800', color: Colors.textPrimary, marginTop: 12, marginBottom: 4 },
  resultSub: { fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: 'center' },
  floorPlanPreview: {
    backgroundColor: Colors.card, borderRadius: Radius.lg,
    height: 220, marginBottom: Spacing.lg,
    justifyContent: 'center', alignItems: 'center',
    ...Shadow.md,
  },
  floorPlanPlaceholder: { alignItems: 'center' },
  floorPlanPlaceholderText: { fontSize: FontSize.md, fontWeight: '700', color: Colors.textMuted, marginTop: 10 },
  floorPlanPlaceholderSub: { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 4, textAlign: 'center' },
  resultRoom: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: Colors.card, borderRadius: Radius.sm, padding: 10, marginBottom: 6, ...Shadow.sm,
  },
  resultRoomName: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.textPrimary },
  resultActions: { flexDirection: 'row', gap: 10, marginBottom: Spacing.md },
  actionBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, padding: 12, borderRadius: Radius.md, ...Shadow.sm,
  },
  actionBtnText: { fontSize: FontSize.sm, fontWeight: '700', color: '#fff' },
});


