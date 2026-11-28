import { browser } from "wxt/browser";
import type { LibrarySnapshot } from "@promptizer/shared";
import type { SnapshotStore } from "./library-cache.ts";

const SNAPSHOT_STORAGE_KEY = "promptizer.librarySnapshot";

export function createBrowserSnapshotStore(): SnapshotStore {
  return {
    async load() {
      const stored = await browser.storage.local.get(SNAPSHOT_STORAGE_KEY);
      return stored[SNAPSHOT_STORAGE_KEY] as LibrarySnapshot | undefined;
    },
    async save(snapshot) {
      await browser.storage.local.set({ [SNAPSHOT_STORAGE_KEY]: snapshot });
    },
    async clear() {
      await browser.storage.local.remove(SNAPSHOT_STORAGE_KEY);
    },
  };
}
