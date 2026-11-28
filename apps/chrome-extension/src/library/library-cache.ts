import type { LibrarySnapshot, PackSummary, Prompt } from "@promptizer/shared";

export const SNAPSHOT_STALE_AFTER_SECONDS = 15 * 60;

export interface SnapshotStore {
  load(): Promise<LibrarySnapshot | undefined>;
  save(snapshot: LibrarySnapshot): Promise<void>;
  clear(): Promise<void>;
}

export interface LibraryCacheState {
  prompts: Prompt[];
  packs: PackSummary[];
  isStale: boolean;
}

export interface LibraryCache {
  read(): Promise<LibraryCacheState>;
  save(snapshot: LibrarySnapshot): Promise<void>;
  clear(): Promise<void>;
}

const EMPTY_STATE: LibraryCacheState = { prompts: [], packs: [], isStale: true };

function isLibrarySnapshot(value: unknown): value is LibrarySnapshot {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const candidate = value as Partial<LibrarySnapshot>;
  return Array.isArray(candidate.prompts) && Array.isArray(candidate.packs) && typeof candidate.fetchedAt === "number";
}

export function createLibraryCache(store: SnapshotStore, now: () => number = () => Date.now()): LibraryCache {
  return {
    async read() {
      let stored: unknown;
      try {
        stored = await store.load();
      } catch {
        return EMPTY_STATE;
      }
      if (!isLibrarySnapshot(stored)) {
        return EMPTY_STATE;
      }
      const ageSeconds = Math.floor(now() / 1000) - stored.fetchedAt;
      return { prompts: stored.prompts, packs: stored.packs, isStale: ageSeconds > SNAPSHOT_STALE_AFTER_SECONDS };
    },
    save(snapshot) {
      return store.save(snapshot);
    },
    clear() {
      return store.clear();
    },
  };
}
