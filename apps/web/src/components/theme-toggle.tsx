"use client";

import { MoonIcon, SunIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSetThemeMode, useThemeMode } from "@/hooks/use-theme-mode";

export function ThemeToggle() {
  const mode = useThemeMode();
  const setThemeMode = useSetThemeMode();
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      aria-label={mode === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      onClick={() => setThemeMode(mode === "dark" ? "light" : "dark")}
    >
      {mode === "dark" ? <SunIcon aria-hidden="true" /> : <MoonIcon aria-hidden="true" />}
    </Button>
  );
}
