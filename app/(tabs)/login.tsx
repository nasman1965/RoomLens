import React from "react";
import { View, Text, TextInput, Button, StyleSheet } from "react-native";

export default function LoginScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Login to RoomLens</Text>

      <TextInput
        style={styles.input}
        placeholder="Email"
        keyboardType="email-address"
      />

      <TextInput style={styles.input} placeholder="Password" secureTextEntry />

      <Button title="Login" onPress={() => {}} />

      <Text style={styles.signupText}>Don’t have an account? Create one.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    padding: 20,
    backgroundColor: "#f2f2f2",
  },
  heading: {
    fontSize: 22,
    fontWeight: "bold",
    marginBottom: 20,
    textAlign: "center",
  },
  input: {
    height: 50,
    borderColor: "#ccc",
    borderWidth: 1,
    marginBottom: 15,
    borderRadius: 8,
    paddingHorizontal: 10,
    backgroundColor: "#fff",
  },
  signupText: {
    marginTop: 15,
    textAlign: "center",
  },
});
