import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Platform, View } from "react-native";
import { BlurView } from "expo-blur";

export default function TabLayout() {
  return (
    <Tabs
      initialRouteName="home"
      screenOptions={({ route }) => ({
        tabBarIcon: ({ color, size, focused }) => {
          let iconName: any;
          switch (route.name) {
            case "home":
              iconName = focused ? "home" : "home-outline";
              break;
            case "login":
              iconName = focused ? "person-circle" : "person-circle-outline";
              break;
            case "client":
              iconName = focused ? "people" : "people-outline";
              break;
            case "project":
              iconName = focused ? "construct" : "construct-outline";
              break;
            case "send":
              iconName = focused ? "paper-plane" : "paper-plane-outline";
              break;
            default:
              iconName = "ellipse-outline";
          }
          return <Ionicons name={iconName} size={focused ? size + 1 : size} color={color} />;
        },
        tabBarActiveTintColor: "#e63946",
        tabBarInactiveTintColor: "#94a3b8",
        headerShown: false,
        tabBarStyle: {
          backgroundColor: "#fff",
          borderTopWidth: 0,
          shadowColor: "#000",
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: 0.08,
          shadowRadius: 12,
          elevation: 12,
          height: Platform.OS === "ios" ? 84 : 64,
          paddingBottom: Platform.OS === "ios" ? 24 : 8,
          paddingTop: 8,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "600",
          letterSpacing: 0.2,
        },
        tabBarItemStyle: {
          borderRadius: 12,
        },
      })}
    >
      <Tabs.Screen name="home" options={{ title: "Home" }} />
      <Tabs.Screen name="login" options={{ title: "Account" }} />
      <Tabs.Screen name="client" options={{ title: "Client" }} />
      <Tabs.Screen name="project" options={{ title: "Project" }} />
      <Tabs.Screen name="send" options={{ title: "Send" }} />
    </Tabs>
  );
}
