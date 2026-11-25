import assert from "node:assert/strict";
import { after, describe, test } from "node:test";
import { CLIENT_KIND_HEADER, EXTENSION_CLIENT_KIND } from "@promptizer/shared";
import type { AuthErrorBody, AuthSession, AuthUser } from "@promptizer/shared";
import { POST as changePassword } from "../src/app/api/auth/change-password/route.ts";
import { GET as me } from "../src/app/api/auth/me/route.ts";
import { POST as refresh } from "../src/app/api/auth/refresh/route.ts";
import { POST as register } from "../src/app/api/auth/register/route.ts";
import { POST as signIn } from "../src/app/api/auth/sign-in/route.ts";
import { POST as signOut } from "../src/app/api/auth/sign-out/route.ts";
import { createAdminClient, isSupabaseConfigured } from "../src/lib/server/supabase.ts";

const ORIGIN = "http://localhost";
const PASSWORD = "correct-horse-battery";
const createdUserIds: string[] = [];

function uniqueEmail(): string {
  return `promptizer-test-${crypto.randomUUID()}@example.com`;
}

function jsonRequest(path: string, body: unknown, headers: Record<string, string> = {}): Request {
  return new Request(`${ORIGIN}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

function bearer(session: AuthSession): Record<string, string> {
  return { Authorization: `Bearer ${session.accessToken}` };
}

async function registerAccount(email = uniqueEmail(), password = PASSWORD): Promise<AuthSession> {
  const response = await register(jsonRequest("/api/auth/register", { email, password, name: "Ada" }));
  assert.equal(response.status, 201);
  const session = (await response.json()) as AuthSession;
  createdUserIds.push(session.user.id);
  return session;
}

describe(
  "accounts against Supabase",
  { skip: !isSupabaseConfigured() && "Supabase environment not configured" },
  () => {
    after(async () => {
      const admin = createAdminClient();
      await Promise.all(createdUserIds.map((id) => admin.auth.admin.deleteUser(id)));
    });

    test("register creates a confirmed account, signs in, and sets session cookies", async () => {
      const email = uniqueEmail();
      const response = await register(jsonRequest("/api/auth/register", { email, password: PASSWORD, name: "Ada" }));
      assert.equal(response.status, 201);
      const session = (await response.json()) as AuthSession;
      createdUserIds.push(session.user.id);
      assert.equal(session.user.email, email);
      assert.equal(session.user.name, "Ada");
      const cookies = response.headers.getSetCookie();
      assert.ok(cookies.some((cookie) => cookie.startsWith("promptizer_access=") && cookie.includes("HttpOnly")));
      assert.ok(
        cookies.some((cookie) => cookie.startsWith("promptizer_refresh=") && cookie.includes("Path=/api/auth")),
      );
    });

    test("extension callers get tokens in the body but never touch dashboard cookies", async () => {
      const email = uniqueEmail();
      await registerAccount(email);
      const extensionHeaders = { [CLIENT_KIND_HEADER]: EXTENSION_CLIENT_KIND };
      const signedIn = await signIn(jsonRequest("/api/auth/sign-in", { email, password: PASSWORD }, extensionHeaders));
      assert.equal(signedIn.status, 200);
      assert.deepEqual(signedIn.headers.getSetCookie(), []);
      const session = (await signedIn.json()) as AuthSession;
      const signedOut = await signOut(
        new Request(`${ORIGIN}/api/auth/sign-out`, {
          method: "POST",
          headers: { ...bearer(session), ...extensionHeaders },
        }),
      );
      assert.deepEqual(signedOut.headers.getSetCookie(), []);
      const rejected = await me(
        new Request(`${ORIGIN}/api/auth/me`, { headers: { ...bearer(session), ...extensionHeaders } }),
      );
      assert.equal(rejected.status, 401);
      assert.deepEqual(rejected.headers.getSetCookie(), []);
    });

    test("register sends no email: the account is confirmed without a confirmation mail", async () => {
      const session = await registerAccount();
      const { data } = await createAdminClient().auth.admin.getUserById(session.user.id);
      assert.ok(data.user?.email_confirmed_at);
      assert.equal(data.user?.confirmation_sent_at, undefined);
    });

    test("duplicate email is refused with a non-enumerating error", async () => {
      const email = uniqueEmail();
      await registerAccount(email);
      const response = await register(jsonRequest("/api/auth/register", { email, password: PASSWORD, name: "Other" }));
      assert.equal(response.status, 409);
      const body = (await response.json()) as AuthErrorBody;
      assert.equal(body.code, "registration_failed");
      assert.doesNotMatch(body.message, /already (registered|exists)/i);
    });

    test("invalid registration returns field-level errors and creates nothing", async () => {
      const response = await register(jsonRequest("/api/auth/register", { email: "bad", password: "x", name: "" }));
      assert.equal(response.status, 422);
      const body = (await response.json()) as AuthErrorBody;
      assert.deepEqual(Object.keys(body.fields ?? {}).sort(), ["email", "name", "password"]);
    });

    test("sign-in with correct credentials returns a session usable on /me", async () => {
      const email = uniqueEmail();
      await registerAccount(email);
      const response = await signIn(jsonRequest("/api/auth/sign-in", { email, password: PASSWORD }));
      assert.equal(response.status, 200);
      const session = (await response.json()) as AuthSession;
      const meResponse = await me(new Request(`${ORIGIN}/api/auth/me`, { headers: bearer(session) }));
      assert.equal(meResponse.status, 200);
      assert.equal(((await meResponse.json()) as AuthUser).email, email);
    });

    test("wrong password and unknown email give the same error", async () => {
      const email = uniqueEmail();
      await registerAccount(email);
      const wrongPassword = await signIn(jsonRequest("/api/auth/sign-in", { email, password: "not-the-password" }));
      const unknownEmail = await signIn(jsonRequest("/api/auth/sign-in", { email: uniqueEmail(), password: PASSWORD }));
      assert.equal(wrongPassword.status, 401);
      assert.equal(unknownEmail.status, 401);
      assert.deepEqual(await wrongPassword.json(), await unknownEmail.json());
    });

    test("anonymous and garbage tokens are treated alike on /me and clear stale cookies", async () => {
      const anonymous = await me(new Request(`${ORIGIN}/api/auth/me`));
      const garbage = await me(new Request(`${ORIGIN}/api/auth/me`, { headers: { Authorization: "Bearer garbage" } }));
      assert.equal(anonymous.status, 401);
      assert.equal(garbage.status, 401);
      assert.equal(((await garbage.json()) as AuthErrorBody).code, "unauthenticated");
      assert.ok(garbage.headers.getSetCookie().some((cookie) => cookie.includes("Max-Age=0")));
    });

    test("sign-out invalidates the session on the server", async () => {
      const session = await registerAccount();
      const response = await signOut(
        new Request(`${ORIGIN}/api/auth/sign-out`, { method: "POST", headers: bearer(session) }),
      );
      assert.equal(response.status, 204);
      const after = await me(new Request(`${ORIGIN}/api/auth/me`, { headers: bearer(session) }));
      assert.equal(after.status, 401);
    });

    test("refresh exchanges a refresh token for a new session; bad token is unauthenticated", async () => {
      const session = await registerAccount();
      const renewed = await refresh(jsonRequest("/api/auth/refresh", { refreshToken: session.refreshToken }));
      assert.equal(renewed.status, 200);
      assert.equal(((await renewed.json()) as AuthSession).user.id, session.user.id);
      const rejected = await refresh(jsonRequest("/api/auth/refresh", { refreshToken: "bogus" }));
      assert.equal(rejected.status, 401);
    });

    test("refresh also works from the httpOnly cookie", async () => {
      const session = await registerAccount();
      const renewed = await refresh(
        new Request(`${ORIGIN}/api/auth/refresh`, {
          method: "POST",
          headers: { cookie: `promptizer_refresh=${session.refreshToken}` },
        }),
      );
      assert.equal(renewed.status, 200);
    });

    test("change password: wrong current password changes nothing", async () => {
      const email = uniqueEmail();
      const session = await registerAccount(email);
      const response = await changePassword(
        jsonRequest(
          "/api/auth/change-password",
          { currentPassword: "wrong-password", newPassword: "brand-new-password" },
          bearer(session),
        ),
      );
      assert.equal(response.status, 422);
      assert.ok(((await response.json()) as AuthErrorBody).fields?.currentPassword);
      const oldStillWorks = await signIn(jsonRequest("/api/auth/sign-in", { email, password: PASSWORD }));
      assert.equal(oldStillWorks.status, 200);
    });

    test("change password: new password works, old one stops, and only the fresh session survives", async () => {
      const email = uniqueEmail();
      const currentSession = await registerAccount(email);
      const otherSession = (await (
        await signIn(jsonRequest("/api/auth/sign-in", { email, password: PASSWORD }))
      ).json()) as AuthSession;
      const response = await changePassword(
        jsonRequest(
          "/api/auth/change-password",
          { currentPassword: PASSWORD, newPassword: "brand-new-password" },
          bearer(currentSession),
        ),
      );
      assert.equal(response.status, 200);
      const freshSession = (await response.json()) as AuthSession;
      assert.ok(response.headers.getSetCookie().some((cookie) => cookie.startsWith("promptizer_access=")));
      assert.equal(
        (await signIn(jsonRequest("/api/auth/sign-in", { email, password: "brand-new-password" }))).status,
        200,
      );
      assert.equal((await signIn(jsonRequest("/api/auth/sign-in", { email, password: PASSWORD }))).status, 401);
      const statusOf = async (session: AuthSession) =>
        (await me(new Request(`${ORIGIN}/api/auth/me`, { headers: bearer(session) }))).status;
      assert.equal(await statusOf(freshSession), 200);
      assert.equal(await statusOf(currentSession), 401);
      assert.equal(await statusOf(otherSession), 401);
    });

    test("change password requires a session", async () => {
      const response = await changePassword(
        jsonRequest("/api/auth/change-password", { currentPassword: "a", newPassword: "b" }),
      );
      assert.equal(response.status, 401);
    });
  },
);
