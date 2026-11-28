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

test("sign-out, rejected renewal and every new sign-in wipe the account's local data", async () => {
  let wipeCount = 0;
  const wipeAccountData = async () => {
    wipeCount += 1;
  };
  const signInResponse = () => new Response(JSON.stringify(sessionExpiringAt(NOW_SECONDS + 3600)), { status: 200 });
  const signedInManager = createSessionManager(
    createAuthClient("https://api.test", routedFetch({ "/api/auth/sign-in": signInResponse })),
    memoryStore(),
    () => NOW_SECONDS * 1000,
    wipeAccountData,
  );
  await signedInManager.signIn("ada@example.com", "pw");
  assert.equal(wipeCount, 1);
  await signedInManager.signOut();
  assert.equal(wipeCount, 2);

  const expiringManager = createSessionManager(
    createAuthClient("https://api.test", respondWith(401, { code: "unauthenticated", message: "expired" })),
    memoryStore(sessionExpiringAt(NOW_SECONDS + 10)),
    () => NOW_SECONDS * 1000,
    wipeAccountData,
  );
  await expiringManager.getAccessToken();
  assert.equal(wipeCount, 3);
});

function routedFetch(routes: Record<string, () => Response>): typeof fetch {
  return async (input) => {
    const path = new URL(String(input)).pathname;
    const route = routes[path];
    if (!route) throw new TypeError("offline");
    return route();
  };
}

const unauthenticatedResponse = () =>
  new Response(JSON.stringify({ code: "unauthenticated", message: "Please sign in again." }), { status: 401 });

test("confirmed user is the server's answer for a live session", async () => {
  const store = memoryStore(sessionExpiringAt(NOW_SECONDS + 3600));
  const client = createAuthClient(
    "https://api.test",
    routedFetch({
      "/api/auth/me": () => new Response(JSON.stringify({ id: "user-1", email: "ada@example.com", name: "Ada L" })),
    }),
  );
  const user = await createSessionManager(client, store, () => NOW_SECONDS * 1000).confirmedUser();
  assert.equal(user?.name, "Ada L");
});

test("confirmed user clears a session the server has revoked", async () => {
  const store = memoryStore(sessionExpiringAt(NOW_SECONDS + 3600));
  const client = createAuthClient(
    "https://api.test",
    routedFetch({ "/api/auth/me": unauthenticatedResponse, "/api/auth/refresh": unauthenticatedResponse }),
  );
  const user = await createSessionManager(client, store, () => NOW_SECONDS * 1000).confirmedUser();
  assert.equal(user, undefined);
  assert.equal(store.current, undefined);
});

test("confirmed user renews a rejected access token when the refresh token still works", async () => {
  const renewedSession = sessionExpiringAt(NOW_SECONDS + 3600, "access-2");
  const store = memoryStore(sessionExpiringAt(NOW_SECONDS + 3600));
  const client = createAuthClient(
    "https://api.test",
    routedFetch({
      "/api/auth/me": unauthenticatedResponse,
      "/api/auth/refresh": () => new Response(JSON.stringify(renewedSession)),
    }),
  );
  const user = await createSessionManager(client, store, () => NOW_SECONDS * 1000).confirmedUser();
  assert.equal(user?.email, "ada@example.com");
  assert.equal(store.current?.accessToken, "access-2");
});

test("confirmed user keeps the stored session while the server is unreachable", async () => {
  const store = memoryStore(sessionExpiringAt(NOW_SECONDS + 3600));
  const client = createAuthClient("https://api.test", failingFetch);
  const user = await createSessionManager(client, store, () => NOW_SECONDS * 1000).confirmedUser();
  assert.equal(user?.email, "ada@example.com");
  assert.equal(store.current?.accessToken, "access-1");
});

test("every request identifies itself as the extension so the server keeps cookies out of it", async () => {
  const seenHeaders: Headers[] = [];
  const recordingFetch: typeof fetch = async (_input, init) => {
    seenHeaders.push(new Headers(init?.headers));
    return new Response("{}", { status: 200 });
  };
  const client = createAuthClient("https://api.test", recordingFetch);
  await client.signIn("a@b.co", "pw");
  await client.refresh("refresh-1");
  await client.me("access-1");
  await client.signOut("access-1");
  assert.equal(seenHeaders.length, 4);
  assert.ok(seenHeaders.every((headers) => headers.get("X-Promptizer-Client") === "extension"));
});

function heldRefreshClient(renewedSession: AuthSession, signInSession: AuthSession) {
  let releaseRefresh: () => void = () => {};
  const refreshHeld = new Promise<void>((resolve) => {
    releaseRefresh = resolve;
  });
  const client = createAuthClient(
    "https://api.test",
    routedFetch({
      "/api/auth/refresh": () => new Response(JSON.stringify(renewedSession)),
      "/api/auth/sign-in": () => new Response(JSON.stringify(signInSession)),
      "/api/auth/sign-out": () => new Response("{}"),
    }),
  );
  const heldClient = {
    ...client,
    refresh: async (refreshToken: string) => {
      await refreshHeld;
      return client.refresh(refreshToken);
    },
  };
  return { client: heldClient, releaseRefresh };
}

test("a renewal that lands after sign-out does not bring the credentials back", async () => {
  const store = memoryStore(sessionExpiringAt(NOW_SECONDS + 10));
  const { client, releaseRefresh } = heldRefreshClient(
    sessionExpiringAt(NOW_SECONDS + 3600, "access-2"),
    sessionExpiringAt(NOW_SECONDS + 3600),
  );
  const manager = createSessionManager(client, store, () => NOW_SECONDS * 1000);
  const tokenRequest = manager.getAccessToken();
  await manager.signOut();
  releaseRefresh();
  assert.deepEqual(await tokenRequest, { ok: true, value: undefined });
  assert.equal(store.current, undefined);
  assert.equal(await manager.currentUser(), undefined);
});

test("a renewal for the previous account does not overwrite a newer sign-in", async () => {
  const store = memoryStore(sessionExpiringAt(NOW_SECONDS + 10));
  const otherAccount: AuthSession = {
    accessToken: "access-b",
    refreshToken: "refresh-b",
    expiresAt: NOW_SECONDS + 3600,
    user: { id: "user-2", email: "grace@example.com", name: "Grace" },
  };
  const { client, releaseRefresh } = heldRefreshClient(sessionExpiringAt(NOW_SECONDS + 3600, "access-2"), otherAccount);
  const manager = createSessionManager(client, store, () => NOW_SECONDS * 1000);
  const tokenRequest = manager.getAccessToken();
  await manager.signIn("grace@example.com", "pw");
  releaseRefresh();
  assert.deepEqual(await tokenRequest, { ok: true, value: "access-b" });
  assert.equal(store.current?.user.email, "grace@example.com");
  assert.equal(store.current?.accessToken, "access-b");
});

function queuedStore(initial: AuthSession): SessionStore & { current: AuthSession | undefined } {
  const STORAGE_ROUND_TRIP_MS = 5;
  let queue: Promise<unknown> = Promise.resolve();
  function enqueue<T>(operation: () => T): Promise<T> {
    const next = queue.then(
      () => new Promise<T>((resolve) => setTimeout(() => resolve(operation()), STORAGE_ROUND_TRIP_MS)),
    );
    queue = next;
    return next;
  }
  const store = {
    current: initial as AuthSession | undefined,
    load: () => enqueue(() => store.current),
    save: (session: AuthSession) =>
      enqueue(() => {
        store.current = session;
      }),
    clear: () =>
      enqueue(() => {
        store.current = undefined;
      }),
  };
  return store;
}

test("a token request issued right after sign-out starts cannot renew the old session back", async () => {
  const store = queuedStore(sessionExpiringAt(NOW_SECONDS + 10));
  const { client, releaseRefresh } = heldRefreshClient(
    sessionExpiringAt(NOW_SECONDS + 3600, "access-2"),
    sessionExpiringAt(NOW_SECONDS + 3600),
  );
  const manager = createSessionManager(client, store, () => NOW_SECONDS * 1000);
  const signOut = manager.signOut();
  const tokenRequest = manager.getAccessToken();
  await signOut;
  releaseRefresh();
  await tokenRequest;
  assert.equal(store.current, undefined);
});

test("a token request issued during a sign-in cannot renew the previous account over the new one", async () => {
  const store = queuedStore(sessionExpiringAt(NOW_SECONDS + 10));
  const otherAccount: AuthSession = {
    accessToken: "access-b",
    refreshToken: "refresh-b",
    expiresAt: NOW_SECONDS + 3600,
    user: { id: "user-2", email: "grace@example.com", name: "Grace" },
  };
  const { client, releaseRefresh } = heldRefreshClient(sessionExpiringAt(NOW_SECONDS + 3600, "access-2"), otherAccount);
  const manager = createSessionManager(client, store, () => NOW_SECONDS * 1000);
  const signIn = manager.signIn("grace@example.com", "pw");
  const tokenRequest = manager.getAccessToken();
  await signIn;
  releaseRefresh();
  await tokenRequest;
  assert.equal(store.current?.accessToken, "access-b");
});
