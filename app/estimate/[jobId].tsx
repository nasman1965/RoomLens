import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, StatusBar,
  TouchableOpacity, Alert, Share, Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontSize, Spacing, Radius, Shadow } from '../../src/constants/theme';
import { XactimateLineItem } from '../../src/types';

// ─── Demo line items ──────────────────────────────────────────────────────────
const DEMO_ITEMS: XactimateLineItem[] = [
  { code: 'DRW-12',  description: 'Drywall removal & disposal',               unit: 'SF',  estimated_quantity: 320,  selected: true,  room: 'Living Room' },
  { code: 'DRY-3',   description: 'Drywall — install 1/2"',                   unit: 'SF',  estimated_quantity: 320,  selected: true,  room: 'Living Room' },
  { code: 'INS-2',   description: 'Insulation — batt R-14',                    unit: 'SF',  estimated_quantity: 180,  selected: true,  room: 'Living Room' },
  { code: 'P-DTX',   description: 'Prime & paint — 2 coats',                   unit: 'SF',  estimated_quantity: 640,  selected: true,  room: 'Living Room' },
  { code: 'FLR-HW2', description: 'Hardwood floor removal',                    unit: 'SF',  estimated_quantity: 220,  selected: false, room: 'Kitchen' },
  { code: 'FLR-SB',  description: 'Subfloor — OSB 3/4" replace',              unit: 'SF',  estimated_quantity: 220,  selected: true,  room: 'Kitchen' },
  { code: 'CAB-R',   description: 'Cabinet removal — lower',                   unit: 'LF',  estimated_quantity: 12,   selected: false, room: 'Kitchen' },
  { code: 'DRY-EQ',  description: 'Dehumidifier — LGR daily rental',           unit: 'DAY', estimated_quantity: 5,    selected: true,  room: 'All' },
  { code: 'AIR-AX',  description: 'Air mover — daily rental',                  unit: 'DAY', estimated_quantity: 5,    selected: true,  room: 'All' },
  { code: 'MOLD-RM', description: 'Antimicrobial spray treatment',             unit: 'SF',  estimated_quantity: 540,  selected: false, room: 'All' },
];

// ─── Unit price estimates (CAD) ───────────────────────────────────────────────
const UNIT_PRICES: Record<string, number> = {
  'DRW-12': 1.80, 'DRY-3': 2.20, 'INS-2': 1.10, 'P-DTX': 1.40,
  'FLR-HW2': 2.50, 'FLR-SB': 3.20, 'CAB-R': 85.00, 'DRY-EQ': 55.00,
  'AIR-AX': 25.00, 'MOLD-RM': 0.90,
};

export default function EstimateScreen() {
  const { jobId } = useLocalSearchParams<{ jobId: string }>();
  const router = useRouter();
  const [items, setItems] = useState<XactimateLineItem[]>(DEMO_ITEMS);
  const [exporting, setExporting] = useState(false);

  const toggleItem = (index: number) => {
    setItems((prev) => prev.map((item, i) => i === index ? { ...item, selected: !item.selected } : item));
  };

  const selectedItems = items.filter((i) => i.selected);
  const totalEstimate = selectedItems.reduce((sum, item) => {
    return sum + (item.estimated_quantity * (UNIT_PRICES[item.code] ?? 2.50));
  }, 0);

  const roomGroups = Array.from(new Set(items.map((i) => i.room ?? 'General')));

  const handleExport = async () => {
    setExporting(true);
    await new Promise((r) => setTimeout(r, 1000));
    setExporting(false);
    Alert.alert(
      'Export Ready',
      'In production, this exports an Xactimate-compatible file (ESX/XactXML) and a PDF estimate draft.\n\nConnect your Supabase backend to enable real export.',
      [{ text: 'OK' }]
    );
  };

  const handleShare = async () => {
    const summary = selectedItems
      .map((i) => `${i.code} — ${i.description}: ${i.estimated_quantity} ${i.unit}`)
      .join('\n');
    await Share.share({
      message: `RoomLensPro Estimate Draft\n\nJob: ${jobId}\nTotal: $${totalEstimate.toFixed(2)} CAD\n\n${summary}`,
    });
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={22} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Estimate Draft</Text>
        <TouchableOpacity onPress={handleShare} style={styles.shareBtn}>
          <Ionicons name="share-outline" size={20} color={Colors.navy} />
        </TouchableOpacity>
      </View>

      {/* Total summary bar */}
      <View style={styles.totalBar}>
        <View>
          <Text style={styles.totalLabel}>Selected Items: {selectedItems.length}/{items.length}</Text>
          <Text style={styles.totalAmount}>${totalEstimate.toLocaleString('en-CA', { minimumFractionDigits: 2 })} CAD</Text>
        </View>
        <TouchableOpacity
          style={[styles.exportBtn, exporting && { opacity: 0.7 }]}
          onPress={handleExport}
          disabled={exporting}
        >
          <Ionicons name="download-outline" size={16} color="#fff" />
          <Text style={styles.exportBtnText}>{exporting ? 'Exporting…' : 'Export ESX'}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
        {/* AI notice */}
        <View style={styles.aiNotice}>
          <Ionicons name="sparkles" size={16} color={Colors.tileEstimate} />
          <Text style={styles.aiNoticeText}>
            AI-generated suggestions. Review each item before exporting to Xactimate.
            Quantities are estimates — adjust as needed.
          </Text>
        </View>

        {/* Items by room */}
        {roomGroups.map((room) => {
          const roomItems = items.filter((i) => (i.room ?? 'General') === room);
          const roomSelected = roomItems.filter((i) => i.selected).length;
          return (
            <View key={room} style={styles.roomGroup}>
              <View style={styles.roomGroupHeader}>
                <Ionicons name="home-outline" size={14} color={Colors.textMuted} />
                <Text style={styles.roomGroupTitle}>{room}</Text>
                <Text style={styles.roomGroupCount}>{roomSelected}/{roomItems.length} selected</Text>
              </View>

              {roomItems.map((item, roomIdx) => {
                const globalIdx = items.findIndex((i) => i === item);
                const unitPrice = UNIT_PRICES[item.code] ?? 2.50;
                const lineTotal = item.estimated_quantity * unitPrice;
                return (
                  <TouchableOpacity
                    key={item.code}
                    style={[styles.lineItem, item.selected && styles.lineItemSelected]}
                    onPress={() => toggleItem(globalIdx)}
                    activeOpacity={0.8}
                  >
                    <View style={[styles.checkbox, item.selected && styles.checkboxActive]}>
                      {item.selected && <Ionicons name="checkmark" size={13} color="#fff" />}
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={styles.lineItemTop}>
                        <Text style={styles.itemCode}>{item.code}</Text>
                        <Text style={[styles.itemTotal, item.selected && { color: Colors.success }]}>
                          ${lineTotal.toFixed(2)}
                        </Text>
                      </View>
                      <Text style={styles.itemDesc} numberOfLines={2}>{item.description}</Text>
                      <Text style={styles.itemQty}>
                        {item.estimated_quantity} {item.unit} × ${unitPrice.toFixed(2)}/{item.unit}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          );
        })}

        {/* Select all / none */}
        <View style={styles.bulkRow}>
          <TouchableOpacity style={styles.bulkBtn} onPress={() => setItems((p) => p.map((i) => ({ ...i, selected: true })))}>
            <Text style={styles.bulkBtnText}>Select All</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.bulkBtn} onPress={() => setItems((p) => p.map((i) => ({ ...i, selected: false })))}>
            <Text style={styles.bulkBtnText}>Clear All</Text>
          </TouchableOpacity>
        </View>

        {/* Export CTA */}
        <TouchableOpacity
          style={[styles.exportCta, exporting && { opacity: 0.7 }]}
          onPress={handleExport}
          disabled={exporting}
        >
          <Ionicons name="document-text-outline" size={20} color="#fff" />
          <Text style={styles.exportCtaText}>
            {exporting ? 'Generating…' : `Export to Xactimate (${selectedItems.length} items)`}
          </Text>
        </TouchableOpacity>

        <Text style={styles.disclaimer}>
          * Estimates are AI-generated and approximate. Unit prices are for guidance only.
          Always review and adjust in Xactimate before submitting to insurer.
        </Text>
      </ScrollView>
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
  shareBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: Colors.background, justifyContent: 'center', alignItems: 'center' },

  totalBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: Colors.navy, paddingHorizontal: Spacing.md, paddingVertical: 14,
  },
  totalLabel: { fontSize: FontSize.xs, color: 'rgba(255,255,255,0.65)', marginBottom: 2 },
  totalAmount: { fontSize: FontSize.xl, fontWeight: '800', color: '#fff' },
  exportBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: Colors.red, borderRadius: Radius.md,
    paddingHorizontal: 14, paddingVertical: 8,
  },
  exportBtnText: { fontSize: FontSize.sm, fontWeight: '700', color: '#fff' },

  body: { flex: 1 },
  bodyContent: { padding: Spacing.md, paddingBottom: 50 },

  aiNotice: {
    flexDirection: 'row', gap: 8, alignItems: 'flex-start',
    backgroundColor: '#fff8e1', borderRadius: Radius.sm, padding: 12, marginBottom: Spacing.md,
  },
  aiNoticeText: { flex: 1, fontSize: FontSize.xs, color: Colors.textSecondary, lineHeight: 18 },

  roomGroup: { marginBottom: Spacing.md },
  roomGroupHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    marginBottom: 8, paddingBottom: 6, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  roomGroupTitle: { flex: 1, fontSize: FontSize.sm, fontWeight: '700', color: Colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 },
  roomGroupCount: { fontSize: FontSize.xs, color: Colors.textMuted },

  lineItem: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    backgroundColor: Colors.card, borderRadius: Radius.sm,
    padding: 12, marginBottom: 6,
    borderWidth: 1.5, borderColor: Colors.border,
    ...Shadow.sm,
  },
  lineItemSelected: { borderColor: Colors.success, backgroundColor: '#f0fdf4' },
  checkbox: {
    width: 22, height: 22, borderRadius: 6, marginTop: 2,
    borderWidth: 2, borderColor: Colors.border,
    justifyContent: 'center', alignItems: 'center',
  },
  checkboxActive: { backgroundColor: Colors.success, borderColor: Colors.success },
  lineItemTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 3 },
  itemCode: { fontSize: FontSize.xs, fontWeight: '700', color: Colors.textMuted, letterSpacing: 0.5 },
  itemTotal: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.textPrimary },
  itemDesc: { fontSize: FontSize.sm, color: Colors.textPrimary, marginBottom: 4 },
  itemQty: { fontSize: FontSize.xs, color: Colors.textMuted },

  bulkRow: { flexDirection: 'row', gap: 10, marginBottom: Spacing.md },
  bulkBtn: {
    flex: 1, padding: 10, borderRadius: Radius.md,
    backgroundColor: Colors.card, borderWidth: 1.5, borderColor: Colors.border,
    alignItems: 'center',
  },
  bulkBtnText: { fontSize: FontSize.xs, fontWeight: '700', color: Colors.textSecondary },

  exportCta: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 10, backgroundColor: Colors.tileEstimate, borderRadius: Radius.md,
    paddingVertical: 15, marginBottom: Spacing.sm, ...Shadow.md,
  },
  exportCtaText: { fontSize: FontSize.md, fontWeight: '800', color: '#fff' },

  disclaimer: {
    fontSize: FontSize.xs, color: Colors.textMuted, textAlign: 'center',
    lineHeight: 18, paddingHorizontal: Spacing.md,
  },
});
