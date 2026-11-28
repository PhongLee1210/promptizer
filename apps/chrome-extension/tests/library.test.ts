import assert from "node:assert/strict";
import { test } from "node:test";
import type { LibrarySnapshot } from "@promptizer/shared";
import { createLibraryCache } from "../src/library/library-cache.ts";
import type { SnapshotStore } from "../src/library/library-cache.ts";
import { createLibraryClient } from "../src/library/library-client.ts";
import { createLibraryManager } from "../src/library/library-manager.ts";

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

function respondWith(status: number, body: unknown): typeof fetch {
  return async () => new Response(JSON.stringify(body), { status });
}

const failingFetch: typeof fetch = async () => {
  throw new TypeError("offline");
};

test("library client maps wrong status codes to retryable, distinct from unauthenticated", async () => {
  const unauthenticated = await createLibraryClient(
    "https://api.test",
    respondWith(401, { code: "unauthenticated", message: "Please sign in again." }),
  ).fetchSnapshot("token");
  assert.ok(!unauthenticated.ok && unauthenticated.error.kind === "unauthenticated");

  const serverDown = await createLibraryClient(
    "https://api.test",
    respondWith(502, { code: "service_unavailable", message: "down" }),
  ).fetchSnapshot("token");
  assert.ok(!serverDown.ok && serverDown.error.kind === "retryable");

  const offline = await createLibraryClient("https://api.test", failingFetch).fetchSnapshot("token");
  assert.ok(!offline.ok && offline.error.kind === "retryable");
});

test("library client identifies itself as the extension", async () => {
  const seenHeaders: Headers[] = [];
  const recordingFetch: typeof fetch = async (_input, init) => {
    seenHeaders.push(new Headers(init?.headers));
    return new Response(JSON.stringify(snapshotAt(NOW_SECONDS)), { status: 200 });
  };
  await createLibraryClient("https://api.test", recordingFetch).fetchSnapshot("token");
  assert.equal(seenHeaders[0]?.get("X-Promptizer-Client"), "extension");
});

test("manual refresh replaces the cache and reports fresh data", async () => {
  const store = memoryStore(undefined);
  const manager = createLibraryManager(
    createLibraryClient("https://api.test", respondWith(200, snapshotAt(NOW_SECONDS))),
    createLibraryCache(store, () => NOW_SECONDS * 1000),
  );
  const status = await manager.refresh("token");
  assert.equal(status.isStale, false);
  assert.equal(status.prompts.length, 1);
  assert.equal(status.lastError, undefined);
  assert.ok(store.current);
});

test("refresh triggered by staleness is just a normal refresh call from the caller's perspective", async () => {
  const store = memoryStore(snapshotAt(NOW_SECONDS - 16 * 60));
  const manager = createLibraryManager(
    createLibraryClient("https://api.test", respondWith(200, snapshotAt(NOW_SECONDS))),
    createLibraryCache(store, () => NOW_SECONDS * 1000),
  );
  const before = await manager.current();
  assert.equal(before.isStale, true);
  const after = await manager.refresh("token");
  assert.equal(after.isStale, false);
});

test("failed refresh leaves the previous cache usable, with an honest error attached", async () => {
  const store = memoryStore(snapshotAt(NOW_SECONDS - 10));
  const manager = createLibraryManager(
    createLibraryClient("https://api.test", failingFetch),
    createLibraryCache(store, () => NOW_SECONDS * 1000),
  );
  const status = await manager.refresh("token");
  assert.equal(status.prompts.length, 1);
  assert.equal(status.isStale, false);
  assert.ok(status.lastError);
  assert.ok(store.current, "the old cache is not wiped on a failed refresh");
});

test("failed refresh with no prior cache reports the honest empty state, not a crash", async () => {
  const manager = createLibraryManager(
    createLibraryClient("https://api.test", failingFetch),
    createLibraryCache(memoryStore(undefined), () => NOW_SECONDS * 1000),
  );
  const status = await manager.refresh("token");
  assert.deepEqual(status.prompts, []);
  assert.deepEqual(status.packs, []);
  assert.ok(status.lastError);
});

test("wipe clears the cache", async () => {
  const store = memoryStore(snapshotAt(NOW_SECONDS));
  const manager = createLibraryManager(
    createLibraryClient("https://api.test", failingFetch),
    createLibraryCache(store),
  );
  await manager.wipe();
  assert.equal(store.current, undefined);
});
