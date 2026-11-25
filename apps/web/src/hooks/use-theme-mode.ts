"use client";

import { useSyncExternalStore } from "react";

export type ThemeMode = "light" | "dark";

function subscribe(onChange: () => void): () => void {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-pz-mode"] });
  return () => observer.disconnect();
}

function readMode(): ThemeMode {
  return document.documentElement.getAttribute("data-pz-mode") === "light" ? "light" : "dark";
}

export function useThemeMode(): ThemeMode {
  return useSyncExternalStore(subscribe, readMode, () => "dark");
}
