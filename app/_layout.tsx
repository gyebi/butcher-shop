import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
} from "@react-navigation/native";

import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import "react-native-reanimated";

import Colors from "@/constants/Colors";
import { useColorScheme } from "@/hooks/use-color-scheme";
import {
  initializeDatabase,
  verifyDatabaseTables,
} from "@/src/db/schema";

export default function RootLayout() {
  const colorScheme = useColorScheme();

  useEffect(() => {
    async function setupDatabase() {
      try {
        await initializeDatabase();
        await verifyDatabaseTables();

        console.log("SQLite database initialized.");
      } catch (error) {
        console.error("Failed to initialize SQLite database:", error);
      }
    }

    void setupDatabase();
  }, []);

  const navigationTheme =
    colorScheme === "dark"
      ? {
          ...DarkTheme,
          colors: {
            ...DarkTheme.colors,
            background: Colors.dark.background,
            card: Colors.dark.card,
            text: Colors.dark.text,
            border: Colors.dark.border,
            primary: Colors.dark.tint,
            notification: Colors.dark.notification,
          },
        }
      : {
          ...DefaultTheme,
          colors: {
            ...DefaultTheme.colors,
            background: Colors.light.background,
            card: Colors.light.card,
            text: Colors.light.text,
            border: Colors.light.border,
            primary: Colors.light.tint,
            notification: Colors.light.notification,
          },
        };

  return (
    <ThemeProvider value={navigationTheme}>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      </Stack>

      <StatusBar style={colorScheme === "dark" ? "light" : "dark"} />
    </ThemeProvider>
  );
}
