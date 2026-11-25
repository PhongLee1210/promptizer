"use client";

import { MoonIcon, SunIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useThemeMode } from "@/hooks/use-theme-mode";
import type { ThemeMode } from "@/hooks/use-theme-mode";
import { THEME_STORAGE_KEY } from "@/lib/theme";

export function applyThemeMode(mode: ThemeMode) {
  document.documentElement.setAttribute("data-pz-mode", mode);
  try {
    localStorage.setItem(THEME_STORAGE_KEY, mode);
  } catch {
    return;
  }
}

export function ThemeToggle() {
  const mode = useThemeMode();
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      aria-label={mode === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      onClick={() => applyThemeMode(mode === "dark" ? "light" : "dark")}
    >
      {mode === "dark" ? <SunIcon aria-hidden="true" /> : <MoonIcon aria-hidden="true" />}
    </Button>
  );
}
