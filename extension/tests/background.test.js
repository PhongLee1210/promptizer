"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");

const extensionDir = path.join(__dirname, "..");

function harness(settings, fetchResult) {
  let messageListener;
  let fetchCalls = 0;
  const event = () => ({ addListener() {} });
  const chrome = {
    storage: { local: { get: async () => settings, set() {} } },
    runtime: {
      onInstalled: event(),
      onMessage: {
        addListener(listener) {
          messageListener = listener;
        },
      },
      openOptionsPage() {},
    },
    commands: { onCommand: event() },
    action: { onClicked: event() },
    tabs: { query: async () => [], sendMessage: async () => {} },
  };
  const context = vm.createContext({
    chrome,
    AbortController,
    TextEncoder,
    setTimeout,
    clearTimeout,
    fetch: async () => {
      fetchCalls += 1;
      return fetchResult;
    },
  });
  context.globalThis = context;
  vm.runInContext(fs.readFileSync(path.join(extensionDir, "background.js"), "utf8"), context);
  return {
    get fetchCalls() {
      return fetchCalls;
    },
    request(message) {
      return new Promise((resolve) => {
        assert.equal(messageListener(message, {}, resolve), true);
      });
    },
  };
}

const payload = { request_id: "request-1", prompt: "write project summary", task_context: "", constraints: [] };

test("background worker performs only the paired Groq request", async () => {
  const response = {
    ok: true,
    async json() {
      return {
        request_id: "request-1",
        decision: "refine",
        refined_prompt: "Write a concise project summary.",
        model: "test-model",
      };
    },
  };
  const app = harness({ enabled: true, pairingToken: "token" }, response);
  const result = await app.request({ type: "PROMPTIZER_REFINE", payload });
  assert.equal(result.ok, true);
  assert.equal(result.data.provider, "groq");
  assert.equal(app.fetchCalls, 1);
});

test("unpaired fallback does not make a network call", async () => {
  const app = harness({ enabled: true, pairingToken: "" });
  const result = await app.request({ type: "PROMPTIZER_REFINE", payload });
  assert.equal(result.ok, false);
  assert.equal(result.error.code, "UNPAIRED");
  assert.equal(app.fetchCalls, 0);
});
