import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

type RoomEntry = {
  id: string;
  name: string;
  length: string;
  width: string;
  height: string;
};

const defaultRoom = (): RoomEntry => ({
  id: Date.now().toString(),
  name: "",
  length: "",
  width: "",
  height: "",
});

export default function ProjectScreen() {
  const router = useRouter();
  const [projectName, setProjectName] = useState("");
  const [location, setLocation] = useState("");
  const [projectType, setProjectType] = useState<"residential" | "commercial">("residential");
  const [rooms, setRooms] = useState<RoomEntry[]>([defaultRoom()]);

  const addRoom = () => setRooms((r) => [...r, defaultRoom()]);
  const removeRoom = (id: string) =>
    setRooms((r) => r.filter((room) => room.id !== id));
  const updateRoom = (id: string, key: keyof RoomEntry, value: string) =>
    setRooms((r) => r.map((room) => (room.id === id ? { ...room, [key]: value } : room)));

  const calcArea = (r: RoomEntry) => {
    const l = parseFloat(r.length);
    const w = parseFloat(r.width);
    if (!isNaN(l) && !isNaN(w)) return (l * w).toFixed(1);
    return null;
  };

  const handleSave = () => {
    if (!projectName.trim()) {
      Alert.alert("Missing Info", "Please enter a project name.");
      return;
    }
    Alert.alert("Project Saved", `"${projectName}" has been saved with ${rooms.length} room(s).`, [
      { text: "Review & Send", onPress: () => router.push("/(tabs)/send") },
      { text: "Keep Editing", style: "cancel" },
    ]);
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <StatusBar barStyle="light-content" />
      <LinearGradient colors={["#0a1628", "#1e3a5f"]} style={styles.header}>
        <Ionicons name="construct-outline" size={36} color="#fff" />
        <Text style={styles.headerTitle}>Project Details</Text>
        <Text style={styles.headerSub}>Define rooms & dimensions</Text>
      </LinearGradient>

      <ScrollView
        style={styles.body}
        contentContainerStyle={styles.bodyContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* Project info */}
        <View style={styles.card}>
          <Text style={styles.sectionLabel}>Project Information</Text>

          <Text style={styles.label}>Project Name *</Text>
          <View style={styles.inputWrapper}>
            <Ionicons name="folder-outline" size={18} color="#94a3b8" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="e.g. Smith Residence"
              placeholderTextColor="#94a3b8"
              value={projectName}
              onChangeText={setProjectName}
            />
          </View>

          <Text style={styles.label}>Location / Address</Text>
          <View style={styles.inputWrapper}>
            <Ionicons name="location-outline" size={18} color="#94a3b8" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="123 Oak Street, Los Angeles"
              placeholderTextColor="#94a3b8"
              value={location}
              onChangeText={setLocation}
            />
          </View>

          <Text style={styles.label}>Project Type</Text>
          <View style={styles.typeRow}>
            {(["residential", "commercial"] as const).map((t) => (
              <TouchableOpacity
                key={t}
                style={[styles.typeBtn, projectType === t && styles.typeBtnActive]}
                onPress={() => setProjectType(t)}
              >
                <Ionicons
                  name={t === "residential" ? "home-outline" : "business-outline"}
                  size={16}
                  color={projectType === t ? "#fff" : "#64748b"}
                />
                <Text
                  style={[styles.typeBtnText, projectType === t && styles.typeBtnTextActive]}
                >
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Rooms */}
        <View style={styles.roomsHeader}>
          <Text style={styles.roomsTitle}>Rooms ({rooms.length})</Text>
          <TouchableOpacity style={styles.addRoomBtn} onPress={addRoom}>
            <Ionicons name="add-circle-outline" size={18} color="#e63946" />
            <Text style={styles.addRoomText}>Add Room</Text>
          </TouchableOpacity>
        </View>

        {rooms.map((room, index) => (
          <View key={room.id} style={styles.roomCard}>
            <View style={styles.roomCardHeader}>
              <Text style={styles.roomIndex}>Room {index + 1}</Text>
              {rooms.length > 1 && (
                <TouchableOpacity onPress={() => removeRoom(room.id)}>
                  <Ionicons name="trash-outline" size={18} color="#e63946" />
                </TouchableOpacity>
              )}
            </View>

            <TextInput
              style={styles.roomNameInput}
              placeholder="Room name (e.g. Living Room)"
              placeholderTextColor="#94a3b8"
              value={room.name}
              onChangeText={(v) => updateRoom(room.id, "name", v)}
            />

            <View style={styles.dimRow}>
              {(["length", "width", "height"] as const).map((dim) => (
                <View key={dim} style={styles.dimField}>
                  <Text style={styles.dimLabel}>
                    {dim.charAt(0).toUpperCase() + dim.slice(1)} (m)
                  </Text>
                  <TextInput
                    style={styles.dimInput}
                    placeholder="0.0"
                    placeholderTextColor="#94a3b8"
                    keyboardType="decimal-pad"
                    value={room[dim]}
                    onChangeText={(v) => updateRoom(room.id, dim, v)}
                  />
                </View>
              ))}
            </View>

            {calcArea(room) && (
              <View style={styles.areaChip}>
                <Ionicons name="resize-outline" size={14} color="#0a1628" />
                <Text style={styles.areaText}>Floor Area: {calcArea(room)} m²</Text>
              </View>
            )}
          </View>
        ))}

        <TouchableOpacity
          style={styles.saveBtn}
          onPress={handleSave}
          activeOpacity={0.85}
        >
          <LinearGradient
            colors={["#e63946", "#c1121f"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.saveGradient}
          >
            <Ionicons name="save-outline" size={20} color="#fff" />
            <Text style={styles.saveText}>Save Project</Text>
          </LinearGradient>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingTop: 70,
    paddingBottom: 32,
    alignItems: "center",
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: "800",
    color: "#fff",
    marginTop: 8,
    letterSpacing: 0.5,
  },
  headerSub: {
    color: "#94c5e8",
    fontSize: 13,
    marginTop: 4,
  },
  body: { flex: 1, backgroundColor: "#f8f9fc" },
  bodyContent: { padding: 20, paddingBottom: 40 },
  card: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
    marginTop: 8,
  },
  sectionLabel: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0a1628",
    marginBottom: 4,
  },
  label: {
    fontSize: 13,
    fontWeight: "600",
    color: "#0a1628",
    marginBottom: 6,
    marginTop: 14,
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: "#e2e8f0",
    borderRadius: 12,
    paddingHorizontal: 12,
    backgroundColor: "#f8f9fc",
    height: 52,
  },
  inputIcon: { marginRight: 8 },
  input: { flex: 1, fontSize: 15, color: "#0a1628" },
  typeRow: { flexDirection: "row", gap: 12, marginTop: 6 },
  typeBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: "#e2e8f0",
    backgroundColor: "#f8f9fc",
  },
  typeBtnActive: {
    backgroundColor: "#0a1628",
    borderColor: "#0a1628",
  },
  typeBtnText: { fontSize: 14, fontWeight: "600", color: "#64748b" },
  typeBtnTextActive: { color: "#fff" },
  roomsHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 24,
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  roomsTitle: { fontSize: 16, fontWeight: "700", color: "#0a1628" },
  addRoomBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    backgroundColor: "#fff0f1",
  },
  addRoomText: { color: "#e63946", fontWeight: "600", fontSize: 13 },
  roomCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  roomCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  roomIndex: { fontSize: 14, fontWeight: "700", color: "#0a1628" },
  roomNameInput: {
    borderWidth: 1.5,
    borderColor: "#e2e8f0",
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 44,
    fontSize: 14,
    color: "#0a1628",
    backgroundColor: "#f8f9fc",
    marginBottom: 10,
  },
  dimRow: { flexDirection: "row", gap: 8 },
  dimField: { flex: 1 },
  dimLabel: { fontSize: 11, fontWeight: "600", color: "#64748b", marginBottom: 4 },
  dimInput: {
    borderWidth: 1.5,
    borderColor: "#e2e8f0",
    borderRadius: 10,
    paddingHorizontal: 10,
    height: 44,
    fontSize: 14,
    color: "#0a1628",
    backgroundColor: "#f8f9fc",
    textAlign: "center",
  },
  areaChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 10,
    backgroundColor: "#f0f9ff",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    alignSelf: "flex-start",
  },
  areaText: { fontSize: 12, fontWeight: "600", color: "#0a1628" },
  saveBtn: {
    marginTop: 24,
    borderRadius: 14,
    overflow: "hidden",
    shadowColor: "#e63946",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 5,
  },
  saveGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 15,
    gap: 8,
  },
  saveText: { color: "#fff", fontSize: 16, fontWeight: "700", letterSpacing: 0.5 },
});
