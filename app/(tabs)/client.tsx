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

type ClientForm = {
  name: string;
  phone: string;
  email: string;
  address: string;
  notes: string;
};

export default function ClientInfoScreen() {
  const router = useRouter();
  const [form, setForm] = useState<ClientForm>({
    name: "",
    phone: "",
    email: "",
    address: "",
    notes: "",
  });
  const [errors, setErrors] = useState<Partial<ClientForm>>({});
  const [saved, setSaved] = useState(false);

  const update = (key: keyof ClientForm, value: string) => {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
    setSaved(false);
  };

  const validate = () => {
    const e: Partial<ClientForm> = {};
    if (!form.name.trim()) e.name = "Client name is required";
    if (!form.phone.trim()) e.phone = "Phone number is required";
    if (form.email && !/\S+@\S+\.\S+/.test(form.email))
      e.email = "Enter a valid email";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = () => {
    if (!validate()) return;
    // TODO: Persist to storage/DB
    setSaved(true);
    Alert.alert("Client Saved", `${form.name} has been added to this project.`, [
      { text: "Next: Project Details", onPress: () => router.push("/(tabs)/project") },
      { text: "Stay Here", style: "cancel" },
    ]);
  };

  const fields: {
    key: keyof ClientForm;
    label: string;
    placeholder: string;
    icon: string;
    keyboardType?: any;
    multiline?: boolean;
  }[] = [
    { key: "name", label: "Full Name", placeholder: "John Smith", icon: "person-outline" },
    { key: "phone", label: "Phone Number", placeholder: "+1 555 000 0000", icon: "call-outline", keyboardType: "phone-pad" },
    { key: "email", label: "Email Address", placeholder: "john@example.com", icon: "mail-outline", keyboardType: "email-address" },
    { key: "address", label: "Property Address", placeholder: "123 Main St, City, State", icon: "location-outline" },
    { key: "notes", label: "Notes (optional)", placeholder: "Any special instructions...", icon: "create-outline", multiline: true },
  ];

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <StatusBar barStyle="light-content" />
      <LinearGradient colors={["#0a1628", "#1e3a5f"]} style={styles.header}>
        <Ionicons name="people-outline" size={36} color="#fff" />
        <Text style={styles.headerTitle}>Client Info</Text>
        <Text style={styles.headerSub}>Enter your client's details</Text>
      </LinearGradient>

      <ScrollView
        style={styles.body}
        contentContainerStyle={styles.bodyContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.card}>
          {fields.map((f) => (
            <View key={f.key}>
              <Text style={styles.label}>{f.label}</Text>
              <View
                style={[
                  styles.inputWrapper,
                  f.multiline && styles.inputWrapperMulti,
                  errors[f.key] ? styles.inputError : null,
                ]}
              >
                <Ionicons
                  name={f.icon as any}
                  size={18}
                  color="#94a3b8"
                  style={[styles.inputIcon, f.multiline && { alignSelf: "flex-start", marginTop: 14 }]}
                />
                <TextInput
                  style={[styles.input, f.multiline && styles.inputMulti]}
                  placeholder={f.placeholder}
                  placeholderTextColor="#94a3b8"
                  keyboardType={f.keyboardType ?? "default"}
                  autoCapitalize={f.key === "email" ? "none" : "words"}
                  multiline={f.multiline}
                  numberOfLines={f.multiline ? 3 : 1}
                  value={form[f.key]}
                  onChangeText={(t) => update(f.key, t)}
                />
              </View>
              {errors[f.key] ? (
                <Text style={styles.errorText}>{errors[f.key]}</Text>
              ) : null}
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
              <Ionicons
                name={saved ? "checkmark-circle-outline" : "save-outline"}
                size={20}
                color="#fff"
              />
              <Text style={styles.saveText}>
                {saved ? "Saved!" : "Save Client"}
              </Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
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
  body: {
    flex: 1,
    backgroundColor: "#f8f9fc",
  },
  bodyContent: {
    padding: 20,
    paddingBottom: 40,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
    marginTop: 8,
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
  inputWrapperMulti: {
    height: 90,
    alignItems: "flex-start",
  },
  inputError: {
    borderColor: "#e63946",
  },
  inputIcon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: "#0a1628",
  },
  inputMulti: {
    textAlignVertical: "top",
    paddingTop: 14,
    paddingBottom: 8,
  },
  errorText: {
    color: "#e63946",
    fontSize: 12,
    marginTop: 4,
    marginLeft: 4,
  },
  saveBtn: {
    marginTop: 28,
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
  saveText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
});
