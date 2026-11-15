"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");

const context = vm.createContext({});
context.globalThis = context;
vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "provider-router.js"), "utf8"), context);
const router = context.PromptizerProviderRouter;
const payload = { request_id: "request-1", prompt: "write project summary" };

test("Nano-first returns on-device output without calling Groq", async () => {
  let groqCalls = 0;
  const nano = {
    async refine() {
      return { ok: true, data: { provider: "gemini-nano" } };
    },
  };
  const result = await router.refine(
    payload,
    { providerMode: "nano-first", allowGroqFallback: true },
    {
      nano,
      groq: async () => {
        groqCalls += 1;
      },
    },
  );
  assert.equal(result.data.provider, "gemini-nano");
  assert.equal(groqCalls, 0);
});

test("eligible Nano failure falls back once", async () => {
  let groqCalls = 0;
  const nano = {
    async refine() {
      return { ok: false, fallback: true, error: { code: "NANO_NOT_READY" } };
    },
  };
  const result = await router.refine(
    payload,
    { providerMode: "nano-first", allowGroqFallback: true },
    {
      nano,
      groq: async () => {
        groqCalls += 1;
        return { ok: true, data: { provider: "groq" } };
      },
    },
  );
  assert.equal(result.data.provider, "groq");
  assert.equal(groqCalls, 1);
});

test("disabled fallback and cancellation never call Groq", async () => {
  for (const nanoResult of [
    { ok: false, fallback: true, error: { code: "NANO_NOT_READY" } },
    { ok: false, fallback: false, error: { code: "CANCELED" } },
  ]) {
    let groqCalls = 0;
    const nano = {
      async refine() {
        return nanoResult;
      },
    };
    await router.refine(
      payload,
      { providerMode: "nano-first", allowGroqFallback: false },
      {
        nano,
        groq: async () => {
          groqCalls += 1;
        },
      },
    );
    assert.equal(groqCalls, 0);
  }
});

test("Groq-only mode bypasses Nano", async () => {
  let nanoCalls = 0;
  const result = await router.refine(
    payload,
    { providerMode: "groq-only" },
    {
      nano: {
        async refine() {
          nanoCalls += 1;
        },
      },
      groq: async () => ({ ok: true, data: { provider: "groq" } }),
    },
  );
  assert.equal(nanoCalls, 0);
  assert.equal(result.data.provider, "groq");
});
