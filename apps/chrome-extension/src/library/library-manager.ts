import type { PackSummary, Prompt } from "@promptizer/shared";
import type { LibraryCache } from "./library-cache.ts";
import type { LibraryClient } from "./library-client.ts";

export interface LibraryStatus {
  prompts: Prompt[];
  packs: PackSummary[];
  isStale: boolean;
  fetchedAt?: number;
  lastError?: string;
}

export interface LibraryManager {
  current(): Promise<LibraryStatus>;
  refresh(accessToken: string): Promise<LibraryStatus>;
  wipe(): Promise<void>;
}

export function createLibraryManager(client: LibraryClient, cache: LibraryCache): LibraryManager {
  let wipeCount = 0;

  return {
    async current() {
      return cache.read();
    },

    async refresh(accessToken) {
      const wipeCountAtStart = wipeCount;
      const result = await client.fetchSnapshot(accessToken);
      if (wipeCount !== wipeCountAtStart) {
        return cache.read();
      }
      if (!result.ok) {
        const previous = await cache.read();
        return { ...previous, lastError: result.error.message };
      }
      await cache.save(result.value);
      return {
        prompts: result.value.prompts,
        packs: result.value.packs,
        isStale: false,
        fetchedAt: result.value.fetchedAt,
      };
    },

    wipe() {
      wipeCount += 1;
      return cache.clear();
    },
  };
}
