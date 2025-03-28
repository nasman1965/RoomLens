import React from "react";
import { View, Text, Button, StyleSheet } from "react-native";

export default function SendScreen() {
  const handleSend = () => {
    // Later: Add logic to send project details
    alert("Project details sent!");
  };

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Ready to Submit?</Text>
      <Button title="Send Project Info" onPress={handleSend} />
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
});
