import assert from "node:assert/strict";
import { test } from "node:test";
import type { AuthSession } from "@promptizer/shared";
import { createAuthClient } from "../src/account/auth-client.ts";
import { createSessionManager } from "../src/account/session-manager.ts";
import type { SessionStore } from "../src/account/session-manager.ts";

const NOW_SECONDS = 1_800_000_000;

function sessionExpiringAt(expiresAt: number, accessToken = "access-1"): AuthSession {
  return {
    accessToken,
    refreshToken: "refresh-1",
    expiresAt,
    user: { id: "user-1", email: "ada@example.com", name: "Ada" },
  };
}

function memoryStore(initial?: AuthSession): SessionStore & { current: AuthSession | undefined } {
  const store = {
    current: initial,
    load: async () => store.current,
    save: async (session: AuthSession) => {
      store.current = session;
    },
    clear: async () => {
      store.current = undefined;
    },
  };
  return store;
}

function respondWith(status: number, body: unknown): typeof fetch {
  return async () => new Response(JSON.stringify(body), { status });
}

const failingFetch: typeof fetch = async () => {
  throw new TypeError("offline");
};

test("client maps wrong credentials to one inline-friendly error", async () => {
  const client = createAuthClient(
    "https://api.test",
    respondWith(401, { code: "invalid_credentials", message: "nope" }),
  );
  const result = await client.signIn("a@b.co", "pw");
  assert.deepEqual(result, { ok: false, error: { kind: "invalid_credentials", message: "nope" } });
});

test("client maps network failure and server errors to retryable, distinct from wrong credentials", async () => {
  const offline = await createAuthClient("https://api.test", failingFetch).signIn("a@b.co", "pw");
  const unavailable = await createAuthClient(
    "https://api.test",
    respondWith(502, { code: "service_unavailable", message: "down" }),
  ).signIn("a@b.co", "pw");
  assert.ok(!offline.ok && offline.error.kind === "retryable");
  assert.ok(!unavailable.ok && unavailable.error.kind === "retryable");
});

test("sign-in persists the session and survives a manager restart", async () => {
  const session = sessionExpiringAt(NOW_SECONDS + 3600);
  const store = memoryStore();
  const client = createAuthClient("https://api.test", respondWith(200, session));
  await createSessionManager(client, store, () => NOW_SECONDS * 1000).signIn("ada@example.com", "pw");
  const restarted = createSessionManager(client, store, () => NOW_SECONDS * 1000);
  assert.equal((await restarted.currentUser())?.email, "ada@example.com");
  assert.deepEqual(await restarted.getAccessToken(), { ok: true, value: "access-1" });
});

test("expiring session is renewed silently and stored", async () => {
  const renewedSession = sessionExpiringAt(NOW_SECONDS + 3600, "access-2");
  const store = memoryStore(sessionExpiringAt(NOW_SECONDS + 10));
  const manager = createSessionManager(
    createAuthClient("https://api.test", respondWith(200, renewedSession)),
    store,
    () => NOW_SECONDS * 1000,
  );
  assert.deepEqual(await manager.getAccessToken(), { ok: true, value: "access-2" });
  assert.equal(store.current?.accessToken, "access-2");
});

test("rejected renewal degrades to a clean signed-out state", async () => {
  const store = memoryStore(sessionExpiringAt(NOW_SECONDS + 10));
  const manager = createSessionManager(
    createAuthClient("https://api.test", respondWith(401, { code: "unauthenticated", message: "expired" })),
    store,
    () => NOW_SECONDS * 1000,
  );
  assert.deepEqual(await manager.getAccessToken(), { ok: true, value: undefined });
  assert.equal(store.current, undefined);
});

test("offline renewal keeps credentials so the user stays signed in", async () => {
  const store = memoryStore(sessionExpiringAt(NOW_SECONDS + 10));
  const manager = createSessionManager(
    createAuthClient("https://api.test", failingFetch),
    store,
    () => NOW_SECONDS * 1000,
  );
  const result = await manager.getAccessToken();
  assert.ok(!result.ok && result.error.kind === "retryable");
  assert.ok(store.current);
});

test("sign-out wipes credentials even when the server is unreachable", async () => {
  const store = memoryStore(sessionExpiringAt(NOW_SECONDS + 3600));
  const manager = createSessionManager(
    createAuthClient("https://api.test", failingFetch),
    store,
    () => NOW_SECONDS * 1000,
  );
  await manager.signOut();
  assert.equal(store.current, undefined);
  assert.equal(await manager.currentUser(), undefined);
});
