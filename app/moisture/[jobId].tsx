import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, StatusBar,
  TouchableOpacity, Modal, TextInput, Alert,
  Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontSize, Spacing, Radius, Shadow } from '../../src/constants/theme';
import {
  MATERIAL_LABELS, MOISTURE_THRESHOLDS, getMoistureStatus, MaterialType,
} from '../../src/constants/app';
import { MoistureReading } from '../../src/types';

// ─── Moisture pin on floor plan ───────────────────────────────────────────────
function MoisturePin({ reading, onPress }: { reading: MoistureReading; onPress: () => void }) {
  const colorMap = {
    green:  Colors.moistureGreen,
    yellow: Colors.moistureYellow,
    red:    Colors.moistureRed,
  };
  return (
    <TouchableOpacity
      style={[
        styles.pin,
        { left: `${reading.x_coord}%`, top: `${reading.y_coord}%`, backgroundColor: colorMap[reading.status] },
      ]}
      onPress={onPress}
    >
      <Text style={styles.pinText}>{Math.round(reading.mc_percent)}</Text>
    </TouchableOpacity>
  );
}

// ─── Reading Row in list ──────────────────────────────────────────────────────
function ReadingRow({ reading, onDelete }: { reading: MoistureReading; onDelete: () => void }) {
  const colorMap = {
    green:  Colors.moistureGreen,
    yellow: Colors.moistureYellow,
    red:    Colors.moistureRed,
  };
  const statusLabel = { green: 'Dry', yellow: 'Caution', red: 'Wet' };

  return (
    <View style={[styles.readingRow, { borderLeftColor: colorMap[reading.status] }]}>
      <View style={{ flex: 1 }}>
        <Text style={styles.readingMC}>
          {reading.mc_percent}% MC
          <Text style={{ color: colorMap[reading.status], fontWeight: '700' }}> ({statusLabel[reading.status]})</Text>
        </Text>
        <Text style={styles.readingMeta}>
          {MATERIAL_LABELS[reading.material_type as MaterialType] ?? reading.material_type}
          {reading.rh_percent ? ` · RH: ${reading.rh_percent}%` : ''}
          {reading.temp_c ? ` · ${reading.temp_c}°C` : ''}
        </Text>
        <Text style={styles.readingDay}>Day {reading.visit_day}</Text>
      </View>
      <TouchableOpacity onPress={onDelete} style={styles.deleteBtn}>
        <Ionicons name="trash-outline" size={15} color={Colors.error} />
      </TouchableOpacity>
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function MoistureScreen() {
  const { jobId } = useLocalSearchParams<{ jobId: string }>();
  const router = useRouter();

  const [readings, setReadings] = useState<MoistureReading[]>([]);
  const [visitDay, setVisitDay] = useState(1);
  const [showAddModal, setShowAddModal] = useState(false);
  const [pendingPin, setPendingPin] = useState<{ x: number; y: number } | null>(null);

  // Add reading form state
  const [mcValue, setMcValue] = useState('');
  const [rhValue, setRhValue] = useState('');
  const [tempValue, setTempValue] = useState('');
  const [material, setMaterial] = useState<MaterialType>('drywall');

  // Tap on floor plan to place pin
  const handleFloorPlanTap = (evt: any) => {
    const { locationX, locationY, target } = evt.nativeEvent;
    // Get container size from layout
    const xPct = Math.max(0, Math.min(100, (locationX / evt.nativeEvent.target.width) * 100));
    const yPct = Math.max(0, Math.min(100, (locationY / evt.nativeEvent.target.height) * 100));
    setPendingPin({ x: xPct, y: yPct });
    setShowAddModal(true);
  };

  const saveReading = () => {
    const mc = parseFloat(mcValue);
    if (isNaN(mc) || mc < 0 || mc > 100) {
      Alert.alert('Invalid Value', 'MC% must be a number between 0 and 100');
      return;
    }

    const status = getMoistureStatus(mc, material);
    const newReading: MoistureReading = {
      id: `m${Date.now()}`,
      job_id: jobId!,
      x_coord: pendingPin?.x ?? 50,
      y_coord: pendingPin?.y ?? 50,
      material_type: material,
      mc_percent: mc,
      rh_percent: rhValue ? parseFloat(rhValue) : undefined,
      temp_c: tempValue ? parseFloat(tempValue) : undefined,
      status,
      reading_date: new Date().toISOString(),
      visit_day: visitDay,
      technician_id: 'local',
    };

    setReadings((prev) => [...prev, newReading]);
    setMcValue('');
    setRhValue('');
    setTempValue('');
    setPendingPin(null);
    setShowAddModal(false);
  };

  const deleteReading = (id: string) => {
    Alert.alert('Delete Reading', 'Remove this moisture reading?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => setReadings((p) => p.filter((r) => r.id !== id)) },
    ]);
  };

  const dayReadings = readings.filter((r) => r.visit_day === visitDay);
  const redCount    = dayReadings.filter((r) => r.status === 'red').length;
  const yellowCount = dayReadings.filter((r) => r.status === 'yellow').length;
  const greenCount  = dayReadings.filter((r) => r.status === 'green').length;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={22} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Moisture Map</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>

        {/* Visit day selector */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Visit Day</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {Array.from({ length: 7 }, (_, i) => i + 1).map((day) => {
                const count = readings.filter((r) => r.visit_day === day).length;
                return (
                  <TouchableOpacity
                    key={day}
                    style={[styles.dayChip, visitDay === day && styles.dayChipActive]}
                    onPress={() => setVisitDay(day)}
                  >
                    <Text style={[styles.dayLabel, visitDay === day && styles.dayLabelActive]}>Day {day}</Text>
                    {count > 0 ? (
                      <View style={styles.dayCount}><Text style={styles.dayCountText}>{count}</Text></View>
                    ) : null}
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>
        </View>

        {/* Floor plan with pins */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Floor Plan — Tap to Pin</Text>
            <TouchableOpacity
              style={styles.addManualBtn}
              onPress={() => { setPendingPin({ x: 50, y: 50 }); setShowAddModal(true); }}
            >
              <Ionicons name="add" size={14} color="#fff" />
              <Text style={styles.addManualText}>Add</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            activeOpacity={1}
            style={styles.floorPlanArea}
            onPress={(e) => {
              const { locationX, locationY } = e.nativeEvent;
              // Approximate percentages based on touch position in the 300px container
              const xPct = Math.max(5, Math.min(90, (locationX / 340) * 100));
              const yPct = Math.max(5, Math.min(90, (locationY / 200) * 100));
              setPendingPin({ x: xPct, y: yPct });
              setShowAddModal(true);
            }}
          >
            <Text style={styles.floorPlanPlaceholder}>
              {dayReadings.length === 0 ? '📐 Tap anywhere to pin a reading' : ''}
            </Text>
            {dayReadings.map((r) => (
              <MoisturePin
                key={r.id}
                reading={r}
                onPress={() => Alert.alert(
                  `${r.mc_percent}% MC`,
                  `${MATERIAL_LABELS[r.material_type as MaterialType]}\nStatus: ${r.status.toUpperCase()}\nDay ${r.visit_day}`
                )}
              />
            ))}
          </TouchableOpacity>

          {/* Legend */}
          <View style={styles.legend}>
            <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: Colors.moistureGreen }]} /><Text style={styles.legendText}>Dry</Text></View>
            <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: Colors.moistureYellow }]} /><Text style={styles.legendText}>Caution</Text></View>
            <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: Colors.moistureRed }]} /><Text style={styles.legendText}>Wet</Text></View>
          </View>
        </View>

        {/* Stats */}
        {dayReadings.length > 0 && (
          <View style={styles.statsRow}>
            <View style={[styles.statBox, { borderColor: Colors.moistureRed }]}>
              <Text style={[styles.statNum, { color: Colors.moistureRed }]}>{redCount}</Text>
              <Text style={styles.statLabel}>Wet</Text>
            </View>
            <View style={[styles.statBox, { borderColor: Colors.moistureYellow }]}>
              <Text style={[styles.statNum, { color: Colors.moistureYellow }]}>{yellowCount}</Text>
              <Text style={styles.statLabel}>Caution</Text>
            </View>
            <View style={[styles.statBox, { borderColor: Colors.moistureGreen }]}>
              <Text style={[styles.statNum, { color: Colors.moistureGreen }]}>{greenCount}</Text>
              <Text style={styles.statLabel}>Dry</Text>
            </View>
            <View style={[styles.statBox, { borderColor: Colors.border }]}>
              <Text style={[styles.statNum, { color: Colors.textPrimary }]}>{dayReadings.length}</Text>
              <Text style={styles.statLabel}>Total</Text>
            </View>
          </View>
        )}

        {/* Readings list */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Day {visitDay} Readings ({dayReadings.length})</Text>
          {dayReadings.length === 0 ? (
            <View style={styles.emptyBox}>
              <Ionicons name="water-outline" size={32} color={Colors.textMuted} />
              <Text style={styles.emptyText}>Tap the floor plan to add moisture readings</Text>
            </View>
          ) : (
            dayReadings.map((r) => (
              <ReadingRow key={r.id} reading={r} onDelete={() => deleteReading(r.id)} />
            ))
          )}
        </View>

        {/* IICRC reference */}
        <View style={styles.iicrcCard}>
          <Text style={styles.iicrcTitle}>IICRC S500 Thresholds</Text>
          {(Object.entries(MOISTURE_THRESHOLDS) as [MaterialType, { green: number; yellow: number }][]).map(([mat, t]) => (
            <View key={mat} style={styles.iicrcRow}>
              <Text style={styles.iicrcMat}>{MATERIAL_LABELS[mat]}</Text>
              <Text style={styles.iicrcVal}>
                <Text style={{ color: Colors.moistureGreen }}>{'<'}{t.green}%</Text>
                {' · '}
                <Text style={{ color: Colors.moistureYellow }}>{t.green}-{t.yellow}%</Text>
                {' · '}
                <Text style={{ color: Colors.moistureRed }}>{'>'}{t.yellow}%</Text>
              </Text>
            </View>
          ))}
        </View>
      </ScrollView>

      {/* ── Add Reading Modal ─────────────────────────────────────────────────── */}
      <Modal visible={showAddModal} transparent animationType="slide" onRequestClose={() => setShowAddModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Moisture Reading</Text>
              <TouchableOpacity onPress={() => setShowAddModal(false)}>
                <Ionicons name="close" size={22} color={Colors.textPrimary} />
              </TouchableOpacity>
            </View>

            {/* Material type */}
            <Text style={styles.inputLabel}>Material Type</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {(Object.keys(MATERIAL_LABELS) as MaterialType[]).map((m) => (
                  <TouchableOpacity
                    key={m}
                    style={[styles.matChip, material === m && styles.matChipActive]}
                    onPress={() => setMaterial(m)}
                  >
                    <Text style={[styles.matChipText, material === m && styles.matChipTextActive]}>
                      {MATERIAL_LABELS[m]}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            {/* MC% */}
            <Text style={styles.inputLabel}>Moisture Content % (MC) *</Text>
            <TextInput
              style={styles.textInput}
              value={mcValue}
              onChangeText={setMcValue}
              keyboardType="decimal-pad"
              placeholder="e.g. 18.5"
              placeholderTextColor={Colors.textMuted}
            />

            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Text style={styles.inputLabel}>RH % (optional)</Text>
                <TextInput
                  style={styles.textInput}
                  value={rhValue}
                  onChangeText={setRhValue}
                  keyboardType="decimal-pad"
                  placeholder="e.g. 65"
                  placeholderTextColor={Colors.textMuted}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.inputLabel}>Temp °C (optional)</Text>
                <TextInput
                  style={styles.textInput}
                  value={tempValue}
                  onChangeText={setTempValue}
                  keyboardType="decimal-pad"
                  placeholder="e.g. 20"
                  placeholderTextColor={Colors.textMuted}
                />
              </View>
            </View>

            {mcValue ? (
              <View style={[styles.previewBadge, {
                backgroundColor: getMoistureStatus(parseFloat(mcValue) || 0, material) === 'green'
                  ? '#e8fdf0' : getMoistureStatus(parseFloat(mcValue) || 0, material) === 'yellow'
                  ? '#fff8e1' : '#fff0f1',
              }]}>
                <Text style={{ fontSize: FontSize.sm, fontWeight: '700', color: Colors.textPrimary }}>
                  Preview: {parseFloat(mcValue) || 0}% MC →{' '}
                  <Text style={{
                    color: getMoistureStatus(parseFloat(mcValue) || 0, material) === 'green'
                      ? Colors.moistureGreen : getMoistureStatus(parseFloat(mcValue) || 0, material) === 'yellow'
                      ? Colors.moistureYellow : Colors.moistureRed,
                  }}>
                    {(getMoistureStatus(parseFloat(mcValue) || 0, material) as string).toUpperCase()}
                  </Text>
                </Text>
              </View>
            ) : null}

            <TouchableOpacity style={styles.saveBtn} onPress={saveReading}>
              <Text style={styles.saveBtnText}>Save Reading</Text>
            </TouchableOpacity>
          </View>
        </View>
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
  body: { flex: 1 },
  bodyContent: { padding: Spacing.md, paddingBottom: 50 },
  section: { marginBottom: Spacing.lg },
  sectionTitle: { fontSize: FontSize.xs, fontWeight: '700', color: Colors.textPrimary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: Spacing.sm },
  sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.sm },

  // Day selector
  dayChip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: Radius.full,
    backgroundColor: Colors.card, borderWidth: 1.5, borderColor: Colors.border,
    flexDirection: 'row', alignItems: 'center', gap: 5,
  },
  dayChipActive: { backgroundColor: Colors.navy, borderColor: Colors.navy },
  dayLabel: { fontSize: FontSize.xs, fontWeight: '700', color: Colors.textSecondary },
  dayLabelActive: { color: '#fff' },
  dayCount: {
    width: 18, height: 18, borderRadius: 9, backgroundColor: Colors.red,
    justifyContent: 'center', alignItems: 'center',
  },
  dayCountText: { fontSize: 10, fontWeight: '700', color: '#fff' },

  // Floor plan
  floorPlanArea: {
    height: 200, backgroundColor: Colors.card, borderRadius: Radius.lg,
    borderWidth: 2, borderColor: Colors.border, borderStyle: 'dashed',
    marginBottom: 8, position: 'relative',
    justifyContent: 'center', alignItems: 'center',
    ...Shadow.sm,
  },
  floorPlanPlaceholder: { fontSize: FontSize.sm, color: Colors.textMuted, textAlign: 'center' },

  // Pins
  pin: {
    position: 'absolute', width: 28, height: 28, borderRadius: 14,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 2, borderColor: '#fff',
    ...Shadow.md,
    transform: [{ translateX: -14 }, { translateY: -14 }],
  },
  pinText: { fontSize: 9, fontWeight: '800', color: '#fff' },

  // Legend
  legend: { flexDirection: 'row', gap: 16, marginTop: 6 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { fontSize: FontSize.xs, color: Colors.textSecondary },

  addManualBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: Colors.tileFloorplan, borderRadius: Radius.sm,
    paddingHorizontal: 10, paddingVertical: 5,
  },
  addManualText: { fontSize: FontSize.xs, fontWeight: '700', color: '#fff' },

  // Stats
  statsRow: { flexDirection: 'row', gap: 10, marginBottom: Spacing.md },
  statBox: {
    flex: 1, backgroundColor: Colors.card, borderRadius: Radius.md,
    padding: 12, alignItems: 'center', borderWidth: 2, ...Shadow.sm,
  },
  statNum: { fontSize: FontSize.xl, fontWeight: '800' },
  statLabel: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 2 },

  // Reading rows
  readingRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.card, borderRadius: Radius.sm,
    padding: 12, marginBottom: 6, borderLeftWidth: 4, ...Shadow.sm,
  },
  readingMC: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.textPrimary },
  readingMeta: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 3 },
  readingDay: { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 2 },
  deleteBtn: { padding: 6 },

  emptyBox: { alignItems: 'center', padding: Spacing.lg },
  emptyText: { fontSize: FontSize.sm, color: Colors.textMuted, textAlign: 'center', marginTop: 8 },

  // IICRC card
  iicrcCard: {
    backgroundColor: Colors.card, borderRadius: Radius.md,
    padding: Spacing.md, ...Shadow.sm,
  },
  iicrcTitle: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.textPrimary, marginBottom: 10 },
  iicrcRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  iicrcMat: { fontSize: FontSize.xs, color: Colors.textSecondary, flex: 1 },
  iicrcVal: { fontSize: FontSize.xs },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: Colors.card, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: Spacing.lg, paddingBottom: Platform.OS === 'ios' ? 40 : 24,
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.md },
  modalTitle: { fontSize: FontSize.lg, fontWeight: '800', color: Colors.textPrimary },
  inputLabel: { fontSize: FontSize.xs, fontWeight: '700', color: Colors.textSecondary, marginBottom: 5, textTransform: 'uppercase', letterSpacing: 0.4 },
  textInput: {
    backgroundColor: Colors.inputBg, borderWidth: 1.5, borderColor: Colors.border,
    borderRadius: Radius.md, padding: 12, fontSize: FontSize.md,
    color: Colors.textPrimary, marginBottom: 12,
  },
  matChip: {
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: Radius.full,
    borderWidth: 1.5, borderColor: Colors.border, backgroundColor: Colors.card,
  },
  matChipActive: { backgroundColor: Colors.navy, borderColor: Colors.navy },
  matChipText: { fontSize: FontSize.xs, fontWeight: '600', color: Colors.textSecondary },
  matChipTextActive: { color: '#fff' },
  previewBadge: { borderRadius: Radius.sm, padding: 10, marginBottom: 12 },
  saveBtn: {
    backgroundColor: Colors.tileMoisture, borderRadius: Radius.md,
    paddingVertical: 14, alignItems: 'center', ...Shadow.sm,
  },
  saveBtnText: { fontSize: FontSize.md, fontWeight: '800', color: '#fff' },
});
