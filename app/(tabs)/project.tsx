import React from "react";
import { View, Text, TextInput, StyleSheet } from "react-native";

export default function ProjectScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Project Details</Text>

      <TextInput style={styles.input} placeholder="Project Name" />

      <TextInput style={styles.input} placeholder="Location" />

      <TextInput
        style={styles.input}
        placeholder="Dimensions (Auto-filled later)"
        editable={false}
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
