import assert from "node:assert/strict";
import { test } from "node:test";
import { PASSWORD_MAX_BYTES } from "@promptizer/shared";
import { validateChangePassword, validateRegistration, validateSignIn } from "../src/lib/server/validation.ts";

test("registration normalizes email and trims name", () => {
  const result = validateRegistration({ email: "  Ada@Example.COM ", password: "correct-horse", name: " Ada " });
  assert.deepEqual(result, { ok: true, value: { email: "ada@example.com", password: "correct-horse", name: "Ada" } });
});

test("registration reports field-level errors for missing and invalid input", () => {
  const result = validateRegistration({ email: "not-an-email", password: "short" });
  assert.ok(!result.ok);
  assert.deepEqual(Object.keys(result.failure.body.fields ?? {}).sort(), ["email", "name", "password"]);
  assert.equal(result.failure.status, 422);
});

test("registration rejects over-length password and name", () => {
  const result = validateRegistration({
    email: "ada@example.com",
    password: "x".repeat(PASSWORD_MAX_BYTES + 1),
    name: "n".repeat(500),
  });
  assert.ok(!result.ok);
  assert.deepEqual(Object.keys(result.failure.body.fields ?? {}).sort(), ["name", "password"]);
});

test("registration rejects non-object bodies", () => {
  assert.ok(!validateRegistration(null).ok);
  assert.ok(!validateRegistration("text").ok);
});

test("sign-in malformed input is indistinguishable from wrong credentials", () => {
  const result = validateSignIn({ email: "nope", password: "" });
  assert.ok(!result.ok);
  assert.equal(result.failure.body.code, "invalid_credentials");
  assert.equal(result.failure.status, 401);
});

test("change password requires current password and a valid new password", () => {
  const result = validateChangePassword({ newPassword: "short" });
  assert.ok(!result.ok);
  assert.deepEqual(Object.keys(result.failure.body.fields ?? {}).sort(), ["currentPassword", "newPassword"]);
});
