import { API_ORIGIN } from "../account/api-origin.ts";
import { createLibraryCache } from "./library-cache.ts";
import { createLibraryClient } from "./library-client.ts";
import { createLibraryManager } from "./library-manager.ts";
import { createBrowserSnapshotStore } from "./snapshot-store.ts";

export const library = createLibraryManager(
  createLibraryClient(API_ORIGIN),
  createLibraryCache(createBrowserSnapshotStore()),
);
