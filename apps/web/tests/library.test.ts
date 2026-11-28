import assert from "node:assert/strict";
import { after, describe, test } from "node:test";
import type { AuthSession, LibrarySnapshot } from "@promptizer/shared";
import { GET as snapshotRoute } from "../src/app/api/library/snapshot/route.ts";
import { POST as createPromptRoute } from "../src/app/api/prompts/route.ts";
import { POST as register } from "../src/app/api/auth/register/route.ts";
import { createAdminClient, isSupabaseConfigured } from "../src/lib/server/supabase.ts";

const ORIGIN = "http://localhost";
const PASSWORD = "correct-horse-battery";

describe(
  "library snapshot against Supabase",
  { skip: !isSupabaseConfigured() && "Supabase environment not configured" },
  () => {
    const createdUserIds: string[] = [];

    function request(method: string, path: string, session?: AuthSession, body?: unknown): Request {
      const headers: Record<string, string> = {};
      if (session) headers.Authorization = `Bearer ${session.accessToken}`;
      if (body !== undefined) headers["Content-Type"] = "application/json";
      return new Request(`${ORIGIN}${path}`, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    }

    async function registerAccount(): Promise<AuthSession> {
      const email = `promptizer-test-${crypto.randomUUID()}@example.com`;
      const response = await register(
        request("POST", "/api/auth/register", undefined, { email, password: PASSWORD, name: "Ada" }),
      );
      assert.equal(response.status, 201);
      const session = (await response.json()) as AuthSession;
      createdUserIds.push(session.user.id);
      return session;
    }

    async function createPrompt(session: AuthSession, draft: Record<string, unknown>) {
      const response = await createPromptRoute(request("POST", "/api/prompts", session, draft));
      assert.equal(response.status, 201);
      return response.json();
    }

    async function createCategory(session: AuthSession, name: string): Promise<string> {
      const { data, error } = await createAdminClient()
        .from("category")
        .insert({ user_id: session.user.id, name })
        .select("id")
        .single();
      assert.equal(error, null);
      return (data as { id: string }).id;
    }

    after(async () => {
      const admin = createAdminClient();
      await Promise.all(createdUserIds.map((id) => admin.auth.admin.deleteUser(id)));
    });

    test("returns the caller's whole library in one call, with a staleness timestamp", async () => {
      const owner = await registerAccount();
      const category = await createCategory(owner, `Research ${crypto.randomUUID()}`);
      const beforeFetch = Math.floor(Date.now() / 1000);
      await createPrompt(owner, { title: "Prompt A", text: "a", categoryId: category });
      await createPrompt(owner, { title: "Prompt B", text: "b" });

      const response = await snapshotRoute(request("GET", "/api/library/snapshot", owner));
      assert.equal(response.status, 200);
      const snapshot = (await response.json()) as LibrarySnapshot;
      assert.equal(snapshot.prompts.length, 2);
      assert.equal(
        snapshot.packs.some((pack) => pack.id === category && pack.promptCount === 1),
        true,
      );
      assert.ok(snapshot.fetchedAt >= beforeFetch);
    });

    test("anonymous calls are rejected", async () => {
      const response = await snapshotRoute(request("GET", "/api/library/snapshot"));
      assert.equal(response.status, 401);
    });

    test("no other account's prompts or packs appear", async () => {
      const owner = await registerAccount();
      const stranger = await registerAccount();
      await createCategory(owner, `Owner only ${crypto.randomUUID()}`);
      await createPrompt(owner, { title: "Owner only prompt", text: "x" });

      const strangerSnapshot = (await (
        await snapshotRoute(request("GET", "/api/library/snapshot", stranger))
      ).json()) as LibrarySnapshot;
      assert.equal(strangerSnapshot.prompts.length, 0);
      assert.equal(strangerSnapshot.packs.length, 0);
    });
  },
);
