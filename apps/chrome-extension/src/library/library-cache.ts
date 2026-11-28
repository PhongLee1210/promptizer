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
  fetchedAt?: number;
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
      return {
        prompts: stored.prompts,
        packs: stored.packs,
        isStale: ageSeconds > SNAPSHOT_STALE_AFTER_SECONDS,
        fetchedAt: stored.fetchedAt,
      };
    },
    save(snapshot) {
      return store.save(snapshot);
    },
    clear() {
      return store.clear();
    },
  };
}

export async function replaceCachedPrompt(cache: LibraryCache, prompt: Prompt): Promise<boolean> {
  const current = await cache.read();
  if (current.fetchedAt === undefined || !current.prompts.some((cached) => cached.id === prompt.id)) {
    return false;
  }
  await cache.save({
    prompts: current.prompts.map((cached) => (cached.id === prompt.id ? prompt : cached)),
    packs: current.packs,
    fetchedAt: current.fetchedAt,
  });
  return true;
}

export function withoutPrompt(
  library: { prompts: Prompt[]; packs: PackSummary[] },
  id: string,
): { prompts: Prompt[]; packs: PackSummary[] } {
  const removedPackId = library.prompts.find((prompt) => prompt.id === id)?.category?.id;
  return {
    prompts: library.prompts.filter((prompt) => prompt.id !== id),
    packs: library.packs.map((pack) =>
      pack.id === removedPackId ? { ...pack, promptCount: Math.max(pack.promptCount - 1, 0) } : pack,
    ),
  };
}

export async function removeCachedPrompt(cache: LibraryCache, id: string): Promise<boolean> {
  const current = await cache.read();
  if (current.fetchedAt === undefined || !current.prompts.some((cached) => cached.id === id)) {
    return false;
  }
  await cache.save({ ...withoutPrompt(current, id), fetchedAt: current.fetchedAt });
  return true;
}
