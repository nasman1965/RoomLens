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
  ActivityIndicator,
  Alert,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";

type SendMethod = "email" | "whatsapp" | "sms";

export default function SendScreen() {
  const [recipientEmail, setRecipientEmail] = useState("");
  const [recipientPhone, setRecipientPhone] = useState("");
  const [message, setMessage] = useState(
    "Please find attached the room measurement report for your project."
  );
  const [method, setMethod] = useState<SendMethod>("email");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const methods: { key: SendMethod; icon: string; label: string; color: string }[] = [
    { key: "email", icon: "mail-outline", label: "Email", color: "#e63946" },
    { key: "whatsapp", icon: "logo-whatsapp", label: "WhatsApp", color: "#25D366" },
    { key: "sms", icon: "chatbubble-outline", label: "SMS", color: "#0a1628" },
  ];

  const handleSend = async () => {
    if (method === "email" && !recipientEmail.trim()) {
      Alert.alert("Missing Info", "Please enter the recipient's email address.");
      return;
    }
    if ((method === "whatsapp" || method === "sms") && !recipientPhone.trim()) {
      Alert.alert("Missing Info", "Please enter the recipient's phone number.");
      return;
    }

    setLoading(true);
    // TODO: Connect to real API / email service
    await new Promise((r) => setTimeout(r, 2000));
    setLoading(false);
    setSent(true);
    Alert.alert(
      "Report Sent! ✅",
      `Your project report has been sent via ${method.toUpperCase()}.`,
      [{ text: "Done", onPress: () => setSent(false) }]
    );
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <StatusBar barStyle="light-content" />
      <LinearGradient colors={["#0a1628", "#1e3a5f"]} style={styles.header}>
        <Ionicons name="paper-plane-outline" size={36} color="#fff" />
        <Text style={styles.headerTitle}>Send Report</Text>
        <Text style={styles.headerSub}>Deliver your project to the client</Text>
      </LinearGradient>

      <ScrollView
        style={styles.body}
        contentContainerStyle={styles.bodyContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* Send method selector */}
        <View style={styles.card}>
          <Text style={styles.sectionLabel}>Delivery Method</Text>
          <View style={styles.methodRow}>
            {methods.map((m) => (
              <TouchableOpacity
                key={m.key}
                style={[
                  styles.methodBtn,
                  method === m.key && { borderColor: m.color, backgroundColor: m.color + "12" },
                ]}
                onPress={() => setMethod(m.key)}
                activeOpacity={0.8}
              >
                <Ionicons
                  name={m.icon as any}
                  size={22}
                  color={method === m.key ? m.color : "#94a3b8"}
                />
                <Text
                  style={[
                    styles.methodLabel,
                    method === m.key && { color: m.color },
                  ]}
                >
                  {m.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Recipient info */}
        <View style={styles.card}>
          <Text style={styles.sectionLabel}>Recipient</Text>

          {(method === "email" || method === "sms" || method === "whatsapp") && (
            <>
              {method === "email" && (
                <>
                  <Text style={styles.label}>Email Address *</Text>
                  <View style={styles.inputWrapper}>
                    <Ionicons name="mail-outline" size={18} color="#94a3b8" style={styles.inputIcon} />
                    <TextInput
                      style={styles.input}
                      placeholder="client@example.com"
                      placeholderTextColor="#94a3b8"
                      keyboardType="email-address"
                      autoCapitalize="none"
                      value={recipientEmail}
                      onChangeText={setRecipientEmail}
                    />
                  </View>
                </>
              )}

              {(method === "whatsapp" || method === "sms") && (
                <>
                  <Text style={styles.label}>Phone Number *</Text>
                  <View style={styles.inputWrapper}>
                    <Ionicons name="call-outline" size={18} color="#94a3b8" style={styles.inputIcon} />
                    <TextInput
                      style={styles.input}
                      placeholder="+1 555 000 0000"
                      placeholderTextColor="#94a3b8"
                      keyboardType="phone-pad"
                      value={recipientPhone}
                      onChangeText={setRecipientPhone}
                    />
                  </View>
                </>
              )}
            </>
          )}

          <Text style={styles.label}>Message</Text>
          <View style={[styles.inputWrapper, styles.inputWrapperMulti]}>
            <TextInput
              style={[styles.input, styles.inputMulti]}
              placeholder="Add a personal message..."
              placeholderTextColor="#94a3b8"
              multiline
              numberOfLines={4}
              value={message}
              onChangeText={setMessage}
            />
          </View>
        </View>

        {/* Summary preview */}
        <View style={styles.summaryCard}>
          <View style={styles.summaryRow}>
            <Ionicons name="document-text-outline" size={18} color="#0a1628" />
            <Text style={styles.summaryTitle}>What will be sent</Text>
          </View>
          {[
            "Client information & contact details",
            "Project name & location",
            "Room dimensions & floor areas",
            "Total area summary",
          ].map((item, i) => (
            <View key={i} style={styles.summaryItem}>
              <Ionicons name="checkmark-circle" size={16} color="#22c55e" />
              <Text style={styles.summaryText}>{item}</Text>
            </View>
          ))}
        </View>

        {/* Send button */}
        <TouchableOpacity
          style={styles.sendBtn}
          onPress={handleSend}
          disabled={loading}
          activeOpacity={0.85}
        >
          <LinearGradient
            colors={["#e63946", "#c1121f"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.sendGradient}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons
                  name={sent ? "checkmark-done-outline" : "paper-plane-outline"}
                  size={20}
                  color="#fff"
                />
                <Text style={styles.sendText}>
                  {sent ? "Sent!" : `Send via ${method.charAt(0).toUpperCase() + method.slice(1)}`}
                </Text>
              </>
            )}
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
    marginBottom: 16,
  },
  sectionLabel: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0a1628",
    marginBottom: 14,
  },
  methodRow: {
    flexDirection: "row",
    gap: 10,
  },
  methodBtn: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: "#e2e8f0",
    backgroundColor: "#f8f9fc",
    gap: 6,
  },
  methodLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#94a3b8",
  },
  label: {
    fontSize: 13,
    fontWeight: "600",
    color: "#0a1628",
    marginBottom: 6,
    marginTop: 8,
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
  inputWrapperMulti: {
    height: 100,
    alignItems: "flex-start",
    paddingVertical: 10,
  },
  inputIcon: { marginRight: 8 },
  input: { flex: 1, fontSize: 15, color: "#0a1628" },
  inputMulti: { textAlignVertical: "top" },
  summaryCard: {
    backgroundColor: "#f0f9ff",
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: "#bae6fd",
    marginBottom: 16,
  },
  summaryRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  summaryTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0a1628",
  },
  summaryItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 6,
  },
  summaryText: {
    fontSize: 13,
    color: "#334155",
  },
  sendBtn: {
    borderRadius: 14,
    overflow: "hidden",
    shadowColor: "#e63946",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 5,
  },
  sendGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    gap: 8,
  },
  sendText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
});
