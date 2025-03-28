import { View, Text } from "react-native";

export default function IndexScreen() {
  return (
    <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
      <Text style={{ fontSize: 18 }}>Welcome to RoomLens 🚀</Text>
      <Text style={{ color: "gray", marginTop: 10 }}>
        Choose a tab to begin
      </Text>
    </View>
  );
}
