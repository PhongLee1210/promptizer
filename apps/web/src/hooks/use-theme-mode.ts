"use client";

import { usePreferencesStore } from "@/stores/preferences/preferences-provider";

export type ThemeMode = "light" | "dark";

export function useThemeMode(): ThemeMode {
  return usePreferencesStore((state) => state.resolvedThemeMode);
}

export function useSetThemeMode(): (mode: ThemeMode) => void {
  const setPreference = usePreferencesStore((state) => state.setPreference);
  return (mode) => setPreference("theme_mode", mode);
}
