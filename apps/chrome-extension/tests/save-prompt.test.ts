import assert from "node:assert/strict";
import { test } from "node:test";
import type { AuthClientResult } from "../src/account/auth-client.ts";
import { createPromptClient } from "../src/prompts/prompt-client.ts";
import { createSavePromptHandler } from "../src/prompts/save-prompt-handler.ts";

const DRAFT = { title: "A title", text: "the prompt text" };

function respondWith(status: number, body: unknown): typeof fetch {
  return async () => new Response(JSON.stringify(body), { status });
}

const failingFetch: typeof fetch = async () => {
  throw new TypeError("offline");
};

function tokenOk(value: string | undefined): () => Promise<AuthClientResult<string | undefined>> {
  return () => Promise.resolve({ ok: true, value });
}

function tokenFailing(kind: "unauthenticated" | "retryable"): () => Promise<AuthClientResult<string | undefined>> {
  return () => Promise.resolve({ ok: false, error: { kind, message: "nope" } });
}

test("a signed-in save succeeds and returns the created prompt", async () => {
  const createdPrompt = {
    id: "p1",
    title: DRAFT.title,
    text: DRAFT.text,
    model: null,
    category: null,
    tags: [],
    createdAt: "",
    updatedAt: "",
  };
  const handler = createSavePromptHandler(
    tokenOk("access-token"),
    createPromptClient("https://api.test", respondWith(201, createdPrompt)),
  );
  const result = await handler(DRAFT);
  assert.deepEqual(result, { ok: true, prompt: createdPrompt });
});

test("no stored session is reported as unauthenticated, not a crash", async () => {
  const handler = createSavePromptHandler(
    tokenOk(undefined),
    createPromptClient("https://api.test", respondWith(201, {})),
  );
  const result = await handler(DRAFT);
  assert.equal(result.ok, false);
  assert.ok(!result.ok && result.kind === "unauthenticated");
});

test("a rejected token renewal is reported as unauthenticated", async () => {
  const handler = createSavePromptHandler(
    tokenFailing("unauthenticated"),
    createPromptClient("https://api.test", respondWith(201, {})),
  );
  const result = await handler(DRAFT);
  assert.ok(!result.ok && result.kind === "unauthenticated");
});

test("a network failure while renewing the token is reported as retryable", async () => {
  const handler = createSavePromptHandler(
    tokenFailing("retryable"),
    createPromptClient("https://api.test", respondWith(201, {})),
  );
  const result = await handler(DRAFT);
  assert.ok(!result.ok && result.kind === "retryable");
});

test("a server-side validation failure (e.g. empty text) surfaces its message", async () => {
  const handler = createSavePromptHandler(
    tokenOk("access-token"),
    createPromptClient(
      "https://api.test",
      respondWith(422, {
        code: "validation_failed",
        message: "Please fix the highlighted fields.",
        fields: { text: "Enter the prompt text." },
      }),
    ),
  );
  const result = await handler({ title: "A title", text: "" });
  assert.ok(!result.ok && result.kind === "validation");
  assert.equal(result.ok, false);
});

test("a network failure while saving is reported as retryable, distinct from unauthenticated", async () => {
  const handler = createSavePromptHandler(
    tokenOk("access-token"),
    createPromptClient("https://api.test", failingFetch),
  );
  const result = await handler(DRAFT);
  assert.ok(!result.ok && result.kind === "retryable");
});

test("the save request identifies itself as the extension", async () => {
  const seenHeaders: Headers[] = [];
  const recordingFetch: typeof fetch = async (_input, init) => {
    seenHeaders.push(new Headers(init?.headers));
    return new Response(JSON.stringify({ id: "p1" }), { status: 201 });
  };
  const handler = createSavePromptHandler(
    tokenOk("access-token"),
    createPromptClient("https://api.test", recordingFetch),
  );
  await handler(DRAFT);
  assert.equal(seenHeaders[0]?.get("X-Promptizer-Client"), "extension");
  assert.equal(seenHeaders[0]?.get("Authorization"), "Bearer access-token");
});
