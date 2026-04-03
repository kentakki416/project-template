import "react-native-reanimated"

import { DarkTheme, DefaultTheme, ThemeProvider } from "@react-navigation/native"
import { Stack } from "expo-router"
import { StatusBar } from "expo-status-bar"

import Header from "@/components/layout/Header"
import { COLORS } from "@/constants/color"
import { useColorScheme } from "@/hooks/use-color-scheme"

export const unstable_settings = {
  anchor: "(tabs)",
}

export default function RootLayout() {
  const colorScheme = useColorScheme()

  return (
    <ThemeProvider value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
      <Stack
        screenOptions={{
          header: ({ navigation, options, back }) => (
            <Header navigation={navigation} options={options} back={back} />
          ),
          contentStyle: { backgroundColor: COLORS.background }
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="memo/new" options={{ title: "新規作成" }} />
        <Stack.Screen name="memo/[id]" options={{ title: "編集" }} />
      </Stack>
      <StatusBar style="auto" />
    </ThemeProvider>
  )
}
