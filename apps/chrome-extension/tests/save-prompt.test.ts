import assert from "node:assert/strict";
import { test } from "node:test";
import type { AuthClientResult } from "../src/account/auth-client.ts";
import { createPromptClient } from "../src/prompts/prompt-client.ts";
import {
  createDeletePromptHandler,
  createSavePromptHandler,
  createUpdatePromptHandler,
} from "../src/prompts/save-prompt-handler.ts";
import type { PromptEdit } from "../src/prompts/save-prompt-message.ts";
import {
  DELETE_PROMPT_MESSAGE_TYPE,
  isDeletePromptMessage,
  isUpdatePromptMessage,
  pickPromptEdit,
  UPDATE_PROMPT_MESSAGE_TYPE,
} from "../src/prompts/save-prompt-message.ts";

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

test("an API 401 on save, edit or delete is unauthenticated, a 409 is rejected and a 5xx stays retryable", async () => {
  const writesAgainst = (fetchImplementation: typeof fetch) => {
    const client = createPromptClient("https://api.test", fetchImplementation);
    return [
      createSavePromptHandler(tokenOk("access-token"), client)(DRAFT),
      createUpdatePromptHandler(tokenOk("access-token"), client)("p1", { title: "x" }),
      createDeletePromptHandler(tokenOk("access-token"), client)("p1"),
    ];
  };
  const rejected = await Promise.all(
    writesAgainst(respondWith(401, { code: "unauthenticated", message: "Session expired." })),
  );
  assert.deepEqual(
    rejected.map((result) => !result.ok && result.kind),
    ["unauthenticated", "unauthenticated", "unauthenticated"],
  );
  const unavailable = await Promise.all(writesAgainst(respondWith(503, { code: "service_unavailable", message: "" })));
  assert.deepEqual(
    unavailable.map((result) => !result.ok && result.kind),
    ["retryable", "retryable", "retryable"],
  );
  const conflicting = await Promise.all(writesAgainst(respondWith(409, { code: "conflict", message: "" })));
  assert.deepEqual(
    conflicting.map((result) => !result.ok && result.kind),
    ["rejected", "rejected", "rejected"],
  );
  assert.ok(conflicting.every((result) => !result.ok && result.message.includes("couldn't accept this change")));
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

const STORED_PROMPT = {
  id: "p 1",
  title: "Edited title",
  text: "edited text",
  model: null,
  category: null,
  tags: [],
  createdAt: "",
  updatedAt: "",
};

test("an extension edit uses the dashboard's PATCH update path with only the changed fields", async () => {
  const seen: { url: string; method?: string; body?: string; client: string | null }[] = [];
  const recordingFetch: typeof fetch = async (input, init) => {
    seen.push({
      url: String(input),
      method: init?.method,
      body: init?.body as string,
      client: new Headers(init?.headers).get("X-Promptizer-Client"),
    });
    return new Response(JSON.stringify(STORED_PROMPT), { status: 200 });
  };
  const handler = createUpdatePromptHandler(
    tokenOk("access-token"),
    createPromptClient("https://api.test", recordingFetch),
  );
  const result = await handler("p 1", { title: "Edited title" });
  assert.deepEqual(result, { ok: true, prompt: STORED_PROMPT });
  assert.deepEqual(seen, [
    {
      url: "https://api.test/api/prompts/p%201",
      method: "PATCH",
      body: '{"title":"Edited title"}',
      client: "extension",
    },
  ]);
});

test("an edit's server validation errors carry the field messages for inline display", async () => {
  const handler = createUpdatePromptHandler(
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
  const result = await handler("p1", { text: "" });
  assert.deepEqual(result, {
    ok: false,
    kind: "validation",
    message: "Please fix the highlighted fields.",
    fields: { text: "Enter the prompt text." },
  });
});

test("editing a prompt deleted elsewhere is reported as not found, distinct from retryable", async () => {
  const handler = createUpdatePromptHandler(
    tokenOk("access-token"),
    createPromptClient("https://api.test", respondWith(404, { code: "not_found", message: "Prompt not found." })),
  );
  const result = await handler("p1", { title: "x" });
  assert.ok(!result.ok && result.kind === "not_found");
});

test("a 404 on save is rejected with the server's message, not the deleted-prompt one", async () => {
  const handler = createSavePromptHandler(
    tokenOk("access-token"),
    createPromptClient("https://api.test", respondWith(404, { code: "not_found", message: "Not found." })),
  );
  const result = await handler(DRAFT);
  assert.ok(!result.ok && result.kind === "rejected" && result.message === "Not found.");
});

test("update messages with an unsafe id or malformed changes are ignored by the worker", () => {
  const message = (id: unknown, changes: unknown) => ({ type: UPDATE_PROMPT_MESSAGE_TYPE, id, changes });
  assert.equal(isUpdatePromptMessage(message("3f2a-uuid_1", { title: "x" })), true);
  for (const id of ["", "..", ".", "a/b", "a?b", 7]) {
    assert.equal(isUpdatePromptMessage(message(id, { title: "x" })), false, String(id));
  }
  assert.equal(isUpdatePromptMessage(message("p1", { title: 1 })), false);
  assert.equal(isUpdatePromptMessage(message("p1", null)), false);
  for (const changes of [{}, { title: undefined }, [], { categoryId: "x" }]) {
    assert.equal(isUpdatePromptMessage(message("p1", changes)), false, JSON.stringify(changes));
  }
  assert.deepEqual(pickPromptEdit({ text: "body", categoryId: "x" } as PromptEdit), { text: "body" });
});

test("an edit with no session or no network never reaches the server as a success", async () => {
  const signedOut = createUpdatePromptHandler(tokenOk(undefined), createPromptClient("https://api.test", failingFetch));
  assert.ok(!(await signedOut("p1", { title: "x" })).ok);
  const offline = createUpdatePromptHandler(
    tokenOk("access-token"),
    createPromptClient("https://api.test", failingFetch),
  );
  const result = await offline("p1", { title: "x" });
  assert.ok(!result.ok && result.kind === "retryable");
});

test("an extension delete uses the dashboard's DELETE path and treats 204 as confirmed", async () => {
  const seen: { url: string; method?: string; body?: unknown; client: string | null }[] = [];
  const recordingFetch: typeof fetch = async (input, init) => {
    seen.push({
      url: String(input),
      method: init?.method,
      body: init?.body,
      client: new Headers(init?.headers).get("X-Promptizer-Client"),
    });
    return new Response(null, { status: 204 });
  };
  const handler = createDeletePromptHandler(
    tokenOk("access-token"),
    createPromptClient("https://api.test", recordingFetch),
  );
  assert.deepEqual(await handler("p 1"), { ok: true });
  assert.deepEqual(seen, [
    { url: "https://api.test/api/prompts/p%201", method: "DELETE", body: undefined, client: "extension" },
  ]);
});

test("deleting a prompt already gone is reported as not found; other failures stay retryable", async () => {
  const gone = createDeletePromptHandler(
    tokenOk("access-token"),
    createPromptClient("https://api.test", respondWith(404, { code: "not_found", message: "Prompt not found." })),
  );
  const goneResult = await gone("p1");
  assert.ok(!goneResult.ok && goneResult.kind === "not_found");
  const offline = createDeletePromptHandler(
    tokenOk("access-token"),
    createPromptClient("https://api.test", failingFetch),
  );
  const offlineResult = await offline("p1");
  assert.ok(!offlineResult.ok && offlineResult.kind === "retryable");
  const signedOut = createDeletePromptHandler(tokenOk(undefined), createPromptClient("https://api.test", failingFetch));
  const signedOutResult = await signedOut("p1");
  assert.ok(!signedOutResult.ok && signedOutResult.kind === "unauthenticated");
});

test("delete messages with an unsafe id are ignored by the worker", () => {
  assert.equal(isDeletePromptMessage({ type: DELETE_PROMPT_MESSAGE_TYPE, id: "3f2a-uuid_1" }), true);
  for (const id of ["", "..", ".", "a/b", "a?b", 7, undefined]) {
    assert.equal(isDeletePromptMessage({ type: DELETE_PROMPT_MESSAGE_TYPE, id }), false, String(id));
  }
  assert.equal(isDeletePromptMessage({ type: UPDATE_PROMPT_MESSAGE_TYPE, id: "p1" }), false);
});
