import assert from "node:assert/strict";
import { test } from "node:test";
import type { LibrarySnapshot } from "@promptizer/shared";
import { createLibraryCache } from "../src/library/library-cache.ts";
import type { SnapshotStore } from "../src/library/library-cache.ts";

const NOW_SECONDS = 1_800_000_000;

function snapshotAt(fetchedAt: number): LibrarySnapshot {
  return {
    prompts: [{ id: "p1", title: "A", text: "x", model: null, category: null, tags: [], createdAt: "", updatedAt: "" }],
    packs: [{ id: "c1", name: "Pack", promptCount: 1 }],
    fetchedAt,
  };
}

function memoryStore(initial?: unknown): SnapshotStore & { current: unknown } {
  const store = {
    current: initial,
    load: async () => store.current as LibrarySnapshot | undefined,
    save: async (snapshot: LibrarySnapshot) => {
      store.current = snapshot;
    },
    clear: async () => {
      store.current = undefined;
    },
  };
  return store;
}

test("fresh snapshot reads back as not stale", async () => {
  const store = memoryStore(snapshotAt(NOW_SECONDS - 10));
  const cache = createLibraryCache(store, () => NOW_SECONDS * 1000);
  const state = await cache.read();
  assert.equal(state.isStale, false);
  assert.equal(state.prompts.length, 1);
  assert.equal(state.packs.length, 1);
});

test("snapshot older than the TTL reads back as stale, but data is still returned", async () => {
  const store = memoryStore(snapshotAt(NOW_SECONDS - 16 * 60));
  const cache = createLibraryCache(store, () => NOW_SECONDS * 1000);
  const state = await cache.read();
  assert.equal(state.isStale, true);
  assert.equal(state.prompts.length, 1);
});

test("missing cache degrades to an empty, stale state, never an error", async () => {
  const cache = createLibraryCache(memoryStore(undefined), () => NOW_SECONDS * 1000);
  const state = await cache.read();
  assert.deepEqual(state, { prompts: [], packs: [], isStale: true });
});

test("corrupt cache degrades to an empty, stale state, never an error", async () => {
  for (const corrupt of [{ prompts: "not-an-array" }, { prompts: [], packs: [] }, "a string", 42, null]) {
    const cache = createLibraryCache(memoryStore(corrupt), () => NOW_SECONDS * 1000);
    const state = await cache.read();
    assert.deepEqual(state, { prompts: [], packs: [], isStale: true }, JSON.stringify(corrupt));
  }
});

test("a store that throws on load degrades to an empty, stale state", async () => {
  const throwingStore: SnapshotStore = {
    load: () => Promise.reject(new Error("storage unavailable")),
    save: async () => {},
    clear: async () => {},
  };
  const state = await createLibraryCache(throwingStore).read();
  assert.deepEqual(state, { prompts: [], packs: [], isStale: true });
});

test("save and clear delegate to the store", async () => {
  const store = memoryStore(undefined);
  const cache = createLibraryCache(store);
  await cache.save(snapshotAt(NOW_SECONDS));
  assert.ok(store.current);
  await cache.clear();
  assert.equal(store.current, undefined);
});
