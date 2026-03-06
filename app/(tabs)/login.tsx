import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  Alert,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});

  const validate = () => {
    const newErrors: { email?: string; password?: string } = {};
    if (!email.trim()) newErrors.email = "Email is required";
    else if (!/\S+@\S+\.\S+/.test(email)) newErrors.email = "Enter a valid email";
    if (!password) newErrors.password = "Password is required";
    else if (password.length < 6) newErrors.password = "Minimum 6 characters";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleLogin = async () => {
    if (!validate()) return;
    setLoading(true);
    // Simulate API call
    await new Promise((r) => setTimeout(r, 1500));
    setLoading(false);
    // TODO: Replace with real auth logic
    Alert.alert("Welcome back!", "Login successful.", [
      { text: "OK", onPress: () => router.push("/(tabs)/home") },
    ]);
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <StatusBar barStyle="light-content" />
      <LinearGradient colors={["#0a1628", "#1e3a5f"]} style={styles.header}>
        <Ionicons name="lock-closed-outline" size={40} color="#fff" />
        <Text style={styles.headerTitle}>RoomLens</Text>
        <Text style={styles.headerSub}>Sign in to your account</Text>
      </LinearGradient>

      <ScrollView
        style={styles.body}
        contentContainerStyle={styles.bodyContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.card}>
          {/* Email */}
          <Text style={styles.label}>Email Address</Text>
          <View style={[styles.inputWrapper, errors.email ? styles.inputError : null]}>
            <Ionicons name="mail-outline" size={18} color="#94a3b8" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="you@example.com"
              placeholderTextColor="#94a3b8"
              keyboardType="email-address"
              autoCapitalize="none"
              value={email}
              onChangeText={(t) => { setEmail(t); setErrors((e) => ({ ...e, email: undefined })); }}
            />
          </View>
          {errors.email ? <Text style={styles.errorText}>{errors.email}</Text> : null}

          {/* Password */}
          <Text style={styles.label}>Password</Text>
          <View style={[styles.inputWrapper, errors.password ? styles.inputError : null]}>
            <Ionicons name="key-outline" size={18} color="#94a3b8" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="••••••••"
              placeholderTextColor="#94a3b8"
              secureTextEntry={!showPassword}
              value={password}
              onChangeText={(t) => { setPassword(t); setErrors((e) => ({ ...e, password: undefined })); }}
            />
            <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
              <Ionicons
                name={showPassword ? "eye-off-outline" : "eye-outline"}
                size={18}
                color="#94a3b8"
              />
            </TouchableOpacity>
          </View>
          {errors.password ? <Text style={styles.errorText}>{errors.password}</Text> : null}

          {/* Forgot password */}
          <TouchableOpacity style={styles.forgotBtn}>
            <Text style={styles.forgotText}>Forgot password?</Text>
          </TouchableOpacity>

          {/* Login button */}
          <TouchableOpacity
            style={styles.loginBtn}
            onPress={handleLogin}
            disabled={loading}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={["#e63946", "#c1121f"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.loginGradient}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons name="log-in-outline" size={20} color="#fff" />
                  <Text style={styles.loginText}>Sign In</Text>
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>

          {/* Divider */}
          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Sign up */}
          <TouchableOpacity style={styles.signupBtn} activeOpacity={0.8}>
            <Text style={styles.signupText}>
              New to RoomLens?{" "}
              <Text style={styles.signupLink}>Create account</Text>
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingTop: 70,
    paddingBottom: 36,
    alignItems: "center",
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: "800",
    color: "#fff",
    marginTop: 8,
    letterSpacing: 1,
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
  errorText: {
    color: "#e63946",
    fontSize: 12,
    marginTop: 4,
    marginLeft: 4,
  },
  forgotBtn: {
    alignSelf: "flex-end",
    marginTop: 10,
  },
  forgotText: {
    color: "#e63946",
    fontSize: 13,
    fontWeight: "500",
  },
  loginBtn: {
    marginTop: 24,
    borderRadius: 14,
    overflow: "hidden",
    shadowColor: "#e63946",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 5,
  },
  loginGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 15,
    gap: 8,
  },
  loginText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  divider: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 20,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: "#e2e8f0",
  },
  dividerText: {
    marginHorizontal: 12,
    color: "#94a3b8",
    fontSize: 13,
  },
  signupBtn: {
    alignItems: "center",
  },
  signupText: {
    color: "#64748b",
    fontSize: 14,
  },
  signupLink: {
    color: "#e63946",
    fontWeight: "600",
  },
});
