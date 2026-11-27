import assert from "node:assert/strict";
import { test } from "node:test";
import {
  PASSWORD_MAX_BYTES,
  PROMPT_SEARCH_MAX_LENGTH,
  PROMPT_TEXT_MAX_LENGTH,
  PROMPT_TITLE_MAX_LENGTH,
  PROMPTS_PAGE_SIZE,
  PROMPTS_PAGE_SIZE_MAX,
} from "@promptizer/shared";
import {
  parsePromptListQuery,
  validateChangePassword,
  validatePromptChanges,
  validatePromptDraft,
  validateRegistration,
  validateSignIn,
} from "../src/lib/server/validation.ts";

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

test("prompt draft requires a title and text and trims only the title", () => {
  const result = validatePromptDraft({ title: "  Release notes  ", text: "  keep\r\nspacing  " });
  assert.deepEqual(result, { ok: true, value: { title: "Release notes", text: "  keep\r\nspacing  " } });
  const missing = validatePromptDraft({ title: "   ", text: " \n " });
  assert.equal(missing.ok, false);
  if (missing.ok) return;
  assert.equal(missing.failure.status, 422);
  assert.equal(missing.failure.body.code, "validation_failed");
  assert.deepEqual(missing.failure.body.fields, { title: "Enter a title.", text: "Enter the prompt text." });
});

test("prompt title and text limits count code points, not UTF-16 units", () => {
  const emojiTitle = "😀".repeat(PROMPT_TITLE_MAX_LENGTH);
  assert.equal(validatePromptDraft({ title: emojiTitle, text: "ok" }).ok, true);
  const longTitle = validatePromptDraft({ title: `${emojiTitle}😀`, text: "ok" });
  assert.equal(!longTitle.ok && longTitle.failure.body.fields?.title, "Use at most 200 characters.");
  assert.equal(validatePromptDraft({ title: "t", text: "a".repeat(PROMPT_TEXT_MAX_LENGTH) }).ok, true);
  const longText = validatePromptDraft({ title: "t", text: "a".repeat(PROMPT_TEXT_MAX_LENGTH + 1) });
  assert.equal(!longText.ok && longText.failure.body.fields?.text, "Use at most 20,000 characters.");
});

test("prompt text rejects NUL characters and category ids must be UUIDs", () => {
  const result = validatePromptDraft({ title: "t", text: "a\u0000b", categoryId: "not-a-uuid" });
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.deepEqual(result.failure.body.fields, {
    text: "Remove unsupported characters.",
    categoryId: "Choose one of your categories.",
  });
  const nulTitle = validatePromptDraft({ title: "a\u0000b", text: "x" });
  assert.deepEqual(!nulTitle.ok && nulTitle.failure.body.fields, { title: "Remove unsupported characters." });
  const nulTitleChange = validatePromptChanges({ title: "\u0000x" });
  assert.deepEqual(!nulTitleChange.ok && nulTitleChange.failure.body.fields, {
    title: "Remove unsupported characters.",
  });
  const withCategory = validatePromptDraft({ title: "t", text: "x", categoryId: null });
  assert.deepEqual(withCategory, { ok: true, value: { title: "t", text: "x", categoryId: null } });
});

test("prompt changes validate only the fields present and reject empty updates", () => {
  assert.deepEqual(validatePromptChanges({ text: "new body", ignored: true }), {
    ok: true,
    value: { text: "new body" },
  });
  const empty = validatePromptChanges({ ignored: true });
  assert.equal(!empty.ok && empty.failure.body.message, "Nothing to update.");
  assert.equal(validatePromptChanges(null).ok, false);
  assert.equal(validatePromptChanges(["title"]).ok, false);
  const invalid = validatePromptChanges({ title: "" });
  assert.deepEqual(!invalid.ok && invalid.failure.body.fields, { title: "Enter a title." });
});

test("prompt list query enforces page bounds and truncates search", () => {
  const defaults = parsePromptListQuery(new URLSearchParams());
  assert.deepEqual(defaults, {
    ok: true,
    value: { query: "", categoryId: undefined, tag: undefined, page: 1, pageSize: PROMPTS_PAGE_SIZE },
  });
  for (const page of ["0", "-1", "abc", "1.5"]) {
    const result = parsePromptListQuery(new URLSearchParams({ page }));
    assert.ok(!result.ok && result.failure.body.fields?.page, page);
  }
  const tooLarge = parsePromptListQuery(new URLSearchParams({ pageSize: String(PROMPTS_PAGE_SIZE_MAX + 1) }));
  assert.ok(!tooLarge.ok && tooLarge.failure.body.fields?.pageSize);
  const truncated = parsePromptListQuery(new URLSearchParams({ q: `  ${"q".repeat(PROMPT_SEARCH_MAX_LENGTH + 10)} ` }));
  assert.equal(truncated.ok && truncated.value.query.length, PROMPT_SEARCH_MAX_LENGTH);
  const withNul = parsePromptListQuery(new URLSearchParams({ q: "a\u0000b", tag: "\u0000" }));
  assert.deepEqual(withNul.ok && { query: withNul.value.query, tag: withNul.value.tag }, {
    query: "ab",
    tag: undefined,
  });
});
