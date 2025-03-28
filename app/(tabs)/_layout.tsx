import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

export default function TabLayout() {
  return (
    <Tabs
      initialRouteName="home"
      screenOptions={({ route }) => ({
        tabBarIcon: ({ color, size }) => {
          let iconName: any;
          switch (route.name) {
            case "home":
              iconName = "home-outline";
              break;
            case "login":
              iconName = "person-circle-outline";
              break;
            case "client":
              iconName = "people-outline";
              break;
            case "project":
              iconName = "construct-outline";
              break;
            case "send":
              iconName = "mail-outline";
              break;
            default:
              iconName = "ellipse-outline";
          }
          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: "#f60f00",
        tabBarInactiveTintColor: "gray",
        headerShown: false,
      })}
    >
      <Tabs.Screen name="home" options={{ title: "Home" }} />
      <Tabs.Screen name="login" options={{ title: "Login" }} />
      <Tabs.Screen name="client" options={{ title: "Client Info" }} />
      <Tabs.Screen name="project" options={{ title: "Project" }} />
      <Tabs.Screen name="send" options={{ title: "Send" }} />
    </Tabs>
  );
}
