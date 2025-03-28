import { View, Text, StyleSheet, Image } from "react-native";

export default function HomeScreen() {
  return (
    <View style={styles.container}>
      <Image
        source={require("../../assets/images/roomlens-logo.png")}
        style={styles.logo}
      />

      <Text style={styles.title}>Welcome to RoomLens</Text>
      <Text style={styles.subtitle}>
        Measure your space with precision and ease
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fff",
    padding: 20,
  },
  logo: {
    width: 140,
    height: 140,
    resizeMode: "contain",
    marginBottom: 20,
  },
  title: {
    fontSize: 22,
    fontWeight: "bold",
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 14,
    color: "gray",
    textAlign: "center",
  },
});
