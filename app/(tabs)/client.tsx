import React from "react";
import { View, Text, TextInput, StyleSheet } from "react-native";

export default function ClientInfoScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Client Info</Text>

      <TextInput style={styles.input} placeholder="Client Name" />

      <TextInput
        style={styles.input}
        placeholder="Phone Number"
        keyboardType="phone-pad"
      />

      <TextInput
        style={styles.input}
        placeholder="Email Address"
        keyboardType="email-address"
      />
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
});
