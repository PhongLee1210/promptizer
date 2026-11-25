"use client";

import { useEffect, useState } from "react";

export function usePersistedOpen(storageKey: string, defaultOpen: boolean): [boolean, (nextOpen: boolean) => void] {
  const [open, setOpen] = useState(defaultOpen);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored !== null) {
        setOpen(stored === "true");
      }
    } catch {
      return;
    }
  }, [storageKey]);

  function updateOpen(nextOpen: boolean) {
    setOpen(nextOpen);
    try {
      localStorage.setItem(storageKey, String(nextOpen));
    } catch {
      return;
    }
  }

  return [open, updateOpen];
}
