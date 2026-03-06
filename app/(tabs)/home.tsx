import React from "react";
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  StatusBar,
  Dimensions,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

const { width } = Dimensions.get("window");

export default function HomeScreen() {
  const router = useRouter();

  const features = [
    { icon: "camera-outline", label: "Photo Capture", desc: "Snap rooms instantly" },
    { icon: "resize-outline", label: "Auto Measure", desc: "AI-powered dimensions" },
    { icon: "document-text-outline", label: "Smart Reports", desc: "Instant PDF exports" },
  ];

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* Hero gradient header */}
      <LinearGradient
        colors={["#0a1628", "#1e3a5f"]}
        style={styles.hero}
      >
        <Image
          source={require("../../assets/images/roomlens-logo.png")}
          style={styles.logo}
        />
        <Text style={styles.brandName}>RoomLens</Text>
        <Text style={styles.tagline}>Measure. Document. Deliver.</Text>

        <TouchableOpacity
          style={styles.ctaButton}
          onPress={() => router.push("/(tabs)/project")}
          activeOpacity={0.85}
        >
          <LinearGradient
            colors={["#e63946", "#c1121f"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.ctaGradient}
          >
            <Ionicons name="add-circle-outline" size={20} color="#fff" />
            <Text style={styles.ctaText}>New Project</Text>
          </LinearGradient>
        </TouchableOpacity>
      </LinearGradient>

      {/* Feature cards */}
      <View style={styles.featuresSection}>
        <Text style={styles.sectionTitle}>What RoomLens Does</Text>
        <View style={styles.featureRow}>
          {features.map((f, i) => (
            <View key={i} style={styles.featureCard}>
              <View style={styles.iconCircle}>
                <Ionicons name={f.icon as any} size={24} color="#e63946" />
              </View>
              <Text style={styles.featureLabel}>{f.label}</Text>
              <Text style={styles.featureDesc}>{f.desc}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Quick action row */}
      <View style={styles.quickActions}>
        <TouchableOpacity
          style={styles.actionBtn}
          onPress={() => router.push("/(tabs)/client")}
          activeOpacity={0.8}
        >
          <Ionicons name="people-outline" size={22} color="#0a1628" />
          <Text style={styles.actionBtnText}>Add Client</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionBtn, styles.actionBtnPrimary]}
          onPress={() => router.push("/(tabs)/send")}
          activeOpacity={0.8}
        >
          <Ionicons name="mail-outline" size={22} color="#fff" />
          <Text style={[styles.actionBtnText, { color: "#fff" }]}>Send Report</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8f9fc",
  },
  hero: {
    paddingTop: 70,
    paddingBottom: 40,
    alignItems: "center",
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
  },
  logo: {
    width: 90,
    height: 90,
    resizeMode: "contain",
    borderRadius: 20,
    marginBottom: 12,
  },
  brandName: {
    fontSize: 32,
    fontWeight: "800",
    color: "#fff",
    letterSpacing: 1,
  },
  tagline: {
    fontSize: 14,
    color: "#94c5e8",
    marginTop: 4,
    marginBottom: 24,
    letterSpacing: 2,
    textTransform: "uppercase",
  },
  ctaButton: {
    borderRadius: 14,
    overflow: "hidden",
    shadowColor: "#e63946",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
  },
  ctaGradient: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 32,
    gap: 8,
  },
  ctaText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 16,
    letterSpacing: 0.5,
  },
  featuresSection: {
    padding: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#0a1628",
    marginBottom: 16,
  },
  featureRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 10,
  },
  featureCard: {
    flex: 1,
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 14,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#fff0f1",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
  },
  featureLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#0a1628",
    textAlign: "center",
    marginBottom: 2,
  },
  featureDesc: {
    fontSize: 10,
    color: "#64748b",
    textAlign: "center",
  },
  quickActions: {
    flexDirection: "row",
    paddingHorizontal: 24,
    gap: 12,
    marginTop: 4,
  },
  actionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: "#fff",
    borderWidth: 1.5,
    borderColor: "#e2e8f0",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  actionBtnPrimary: {
    backgroundColor: "#0a1628",
    borderColor: "#0a1628",
  },
  actionBtnText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#0a1628",
  },
});
