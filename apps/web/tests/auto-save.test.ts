import assert from "node:assert/strict";
import { test } from "node:test";
import { createAutoSaver } from "../src/lib/prompts/auto-save.ts";
import type { AutoSaveState, AutoSaveTimers, SaveResult } from "../src/lib/prompts/auto-save.ts";
import { KEEPALIVE_BODY_LIMIT_BYTES, savePromptRequest, toSaveResult } from "../src/lib/prompts/prompt-client.ts";

const DELAY_MS = 800;

function createFakeTimers() {
  let now = 0;
  let nextHandle = 1;
  const pending = new Map<number, { at: number; run: () => void }>();
  const timers: AutoSaveTimers = {
    setTimeout(run, delayMs) {
      const handle = nextHandle++;
      pending.set(handle, { at: now + delayMs, run });
      return handle;
    },
    clearTimeout(handle) {
      pending.delete(handle as number);
    },
  };
  function advance(milliseconds: number) {
    now += milliseconds;
    for (const [handle, timer] of [...pending.entries()].sort((a, b) => a[1].at - b[1].at)) {
      if (timer.at <= now) {
        pending.delete(handle);
        timer.run();
      }
    }
  }
  return { timers, advance, now: () => now };
}

function deferred() {
  let resolve!: (result: SaveResult) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<SaveResult>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

const settle = () => new Promise((resolve) => setImmediate(resolve));

function harness(initialDraft = "start") {
  const clock = createFakeTimers();
  const saves: { draft: string; keepalive: boolean; reply: ReturnType<typeof deferred> }[] = [];
  const states: AutoSaveState[] = [];
  const saver = createAutoSaver<string>({
    initialDraft,
    delayMs: DELAY_MS,
    save(draft, { keepalive }) {
      const reply = deferred();
      saves.push({ draft, keepalive, reply });
      return reply.promise;
    },
    isSameDraft: (first, second) => first === second,
    onStateChange: (state) => states.push(state),
    timers: clock.timers,
    now: clock.now,
  });
  return { saver, saves, states, advance: clock.advance };
}

test("typing then pausing produces exactly one save with the latest draft", async () => {
  const { saver, saves, advance } = harness();
  for (const draft of ["s", "st", "sta", "star", "start!"]) {
    saver.edit(draft);
    advance(100);
  }
  assert.equal(saves.length, 0);
  assert.equal(saver.state.status, "pending");
  advance(DELAY_MS);
  assert.equal(saves.length, 1);
  assert.equal(saves[0].draft, "start!");
  assert.equal(saves[0].keepalive, false);
  saves[0].reply.resolve({ ok: true });
  await settle();
  assert.equal(saver.state.status, "saved");
  assert.equal(saver.hasUnsavedChanges(), false);
});

test("edits during an in-flight save queue a single follow-up save", async () => {
  const { saver, saves, advance } = harness();
  saver.edit("one");
  advance(DELAY_MS);
  saver.edit("two");
  advance(DELAY_MS);
  saver.edit("three");
  advance(DELAY_MS);
  assert.equal(saves.length, 1);
  saves[0].reply.resolve({ ok: true });
  await settle();
  assert.equal(saves.length, 2);
  assert.equal(saves[1].draft, "three");
  saves[1].reply.resolve({ ok: true });
  await settle();
  assert.equal(saves.length, 2);
  assert.equal(saver.state.status, "saved");
});

test("a failed save is visible, keeps the draft dirty and retry succeeds", async () => {
  const { saver, saves, advance } = harness();
  saver.edit("changed");
  advance(DELAY_MS);
  saves[0].reply.resolve({ ok: false, message: "Couldn't save.", retryable: true });
  await settle();
  assert.deepEqual(
    { status: saver.state.status, canRetry: saver.state.canRetry, message: saver.state.failureMessage },
    { status: "failed", canRetry: true, message: "Couldn't save." },
  );
  assert.equal(saver.hasUnsavedChanges(), true);
  saver.retry();
  assert.equal(saver.state.status, "saving");
  assert.equal(saves[1].draft, "changed");
  saves[1].reply.resolve({ ok: true });
  await settle();
  assert.equal(saver.state.status, "saved");
});

test("a rejected save request is reported as a retryable failure", async () => {
  const { saver, saves, advance } = harness();
  saver.edit("changed");
  advance(DELAY_MS);
  saves[0].reply.reject(new TypeError("Failed to fetch"));
  await settle();
  assert.equal(saver.state.status, "failed");
  assert.equal(saver.state.canRetry, true);
});

test("retry is a no-op after a non-retryable failure such as a deleted prompt", async () => {
  const { saver, saves, advance } = harness();
  saver.edit("changed");
  advance(DELAY_MS);
  saves[0].reply.resolve(toSaveResult({ ok: false, kind: "not_found", message: "gone" }));
  await settle();
  assert.equal(saver.state.failureMessage, "This prompt was deleted.");
  saver.retry();
  assert.equal(saves.length, 1);
});

test("editing back to the saved text cancels the pending save", () => {
  const { saver, saves, advance } = harness("start");
  saver.edit("started");
  saver.edit("start");
  advance(DELAY_MS * 2);
  assert.equal(saves.length, 0);
  assert.equal(saver.state.status, "idle");
});

test("flush saves immediately with keepalive and waits for an in-flight save", async () => {
  const { saver, saves, advance } = harness();
  saver.edit("first");
  saver.flush();
  assert.deepEqual(
    saves.map(({ draft, keepalive }) => ({ draft, keepalive })),
    [{ draft: "first", keepalive: true }],
  );
  saver.edit("second");
  saver.flush();
  saver.stop();
  assert.equal(saves.length, 1);
  saves[0].reply.resolve({ ok: true });
  await settle();
  assert.deepEqual(
    saves.map(({ draft, keepalive }) => ({ draft, keepalive })),
    [
      { draft: "first", keepalive: true },
      { draft: "second", keepalive: true },
    ],
  );
  advance(DELAY_MS);
  assert.equal(saves.length, 2);
});

test("stop cancels a pending save and silences in-flight results", async () => {
  const pendingCase = harness();
  pendingCase.saver.edit("never saved");
  pendingCase.saver.stop();
  pendingCase.advance(DELAY_MS * 2);
  assert.equal(pendingCase.saves.length, 0);

  const inFlightCase = harness();
  inFlightCase.saver.edit("in flight");
  inFlightCase.advance(DELAY_MS);
  const statesBeforeStop = inFlightCase.states.length;
  inFlightCase.saver.stop();
  inFlightCase.saves[0].reply.resolve({ ok: true });
  await settle();
  assert.equal(inFlightCase.states.length, statesBeforeStop);
  inFlightCase.saver.edit("after stop");
  inFlightCase.advance(DELAY_MS);
  assert.equal(inFlightCase.saves.length, 1);
});

test("a stopped saver for one prompt never sends its draft through another prompt's saver", async () => {
  const sentByPrompt: { promptId: string; draft: string }[] = [];
  const clock = createFakeTimers();
  function saverFor(promptId: string, initialDraft: string) {
    return createAutoSaver<string>({
      initialDraft,
      delayMs: DELAY_MS,
      save: async (draft) => {
        sentByPrompt.push({ promptId, draft });
        return { ok: true };
      },
      isSameDraft: (first, second) => first === second,
      onStateChange: () => {},
      timers: clock.timers,
      now: clock.now,
    });
  }
  const first = saverFor("p1", "one");
  first.edit("one XYZ");
  first.stop();
  const second = saverFor("p2", "two");
  second.edit("two edited");
  clock.advance(DELAY_MS * 2);
  await settle();
  assert.deepEqual(sentByPrompt, [{ promptId: "p2", draft: "two edited" }]);
});

test("save requests target the bound prompt and drop keepalive for oversized bodies", async () => {
  const calls: { url: string; init: RequestInit }[] = [];
  const fakeFetch = async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    return new Response(null, { status: 204 });
  };
  await savePromptRequest("p1", { text: "small" }, { keepalive: true }, fakeFetch);
  await savePromptRequest(
    "p1",
    { text: "😀".repeat(KEEPALIVE_BODY_LIMIT_BYTES / 4 + 1) },
    { keepalive: true },
    fakeFetch,
  );
  assert.equal(calls[0].url, "/api/prompts/p1");
  assert.equal(calls[0].init.method, "PATCH");
  assert.equal(calls[0].init.keepalive, true);
  assert.equal(calls[1].init.keepalive, false);
});

test("request failures map to save results by kind", async () => {
  const failing = async () => {
    throw new TypeError("offline");
  };
  const network = await savePromptRequest("p1", { text: "x" }, { keepalive: false }, failing);
  assert.equal(network.ok, false);
  assert.deepEqual(toSaveResult(network), {
    ok: false,
    message: "Couldn't save. Check your connection and try again.",
    retryable: true,
  });
  const invalid = await savePromptRequest("p1", { text: "" }, { keepalive: false }, async () =>
    Response.json(
      { code: "validation_failed", message: "Fix", fields: { text: "Enter the prompt text." } },
      { status: 422 },
    ),
  );
  assert.deepEqual(invalid, {
    ok: false,
    kind: "validation",
    message: "Fix",
    fields: { text: "Enter the prompt text." },
  });
  assert.deepEqual(toSaveResult(invalid), { ok: false, message: "Fix", retryable: false });
});
