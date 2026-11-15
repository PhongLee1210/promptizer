"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");

const context = vm.createContext({ TextEncoder, AbortController });
context.globalThis = context;
vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "nano.js"), "utf8"), context);
const nano = context.PromptizerNano;

function model(options = {}) {
  const calls = { availabilityOptions: null, createOptions: null, promptOptions: null, destroyed: 0 };
  const session = {
    contextWindow: 8192,
    async measureContextUsage() {
      return options.usage || 100;
    },
    async prompt(_input, promptOptions) {
      calls.promptOptions = promptOptions;
      if (options.promptError) throw options.promptError;
      return (
        options.output || '{"decision":"refine","refined_prompt":"Write a clear and professional project summary."}'
      );
    },
    destroy() {
      calls.destroyed += 1;
    },
  };
  return {
    calls,
    api: {
      async availability(value) {
        calls.availabilityOptions = value;
        return options.availability || "available";
      },
      async create(value) {
        calls.createOptions = value;
        return session;
      },
    },
  };
}

const payload = {
  request_id: "request-1",
  prompt: "write project summary",
  task_context: "Keep it concise",
  constraints: [],
};

test("uses the approved instruction, structured output, and destroys the session", async () => {
  const fake = model();
  const result = await nano.refine(payload, { languageModel: fake.api, signal: new AbortController().signal });
  assert.equal(result.ok, true);
  assert.equal(result.data.provider, "gemini-nano");
  assert.equal(result.data.refined_prompt, "Write a clear and professional project summary.");
  assert.match(
    fake.calls.createOptions.initialPrompts[0].content,
    /^Refine the following prompt into a clean and well-structured format\./,
  );
  assert.deepEqual(Array.from(fake.calls.createOptions.expectedInputs[0].languages), ["en", "es", "ja", "de", "fr"]);
  assert.equal(fake.calls.promptOptions.responseConstraint.properties.refined_prompt.maxLength, 4000);
  assert.equal(fake.calls.destroyed, 1);
});

test("does not start a session until the model is available", async () => {
  const fake = model({ availability: "downloadable" });
  const result = await nano.refine(payload, { languageModel: fake.api });
  assert.equal(result.ok, false);
  assert.equal(result.fallback, true);
  assert.equal(result.error.code, "NANO_NOT_READY");
  assert.equal(fake.calls.createOptions, null);
});

test("routes known unsupported language to fallback before inference", async () => {
  const fake = model();
  const result = await nano.refine(
    { ...payload, prompt: "Hãy viết lại yêu cầu này rõ ràng hơn" },
    { languageModel: fake.api },
  );
  assert.equal(result.error.code, "NANO_LANGUAGE_UNSUPPORTED");
  assert.equal(fake.calls.availabilityOptions, null);
});

test("keep decision preserves the exact trimmed original", async () => {
  const fake = model({ output: '{"decision":"keep","refined_prompt":"Model changed it"}' });
  const result = await nano.refine({ ...payload, prompt: "  Already clear prompt.  " }, { languageModel: fake.api });
  assert.equal(result.data.refined_prompt, "Already clear prompt.");
});

test("invalid or multiline output is eligible for Groq fallback", async () => {
  const fake = model({ output: '{"decision":"refine","refined_prompt":"First\\nSecond"}' });
  const result = await nano.refine(payload, { languageModel: fake.api });
  assert.equal(result.ok, false);
  assert.equal(result.fallback, true);
  assert.equal(result.error.code, "NANO_FAILED");
  assert.equal(fake.calls.destroyed, 1);
});

test("abort does not fall back to a paid cloud request", async () => {
  const error = new Error("aborted");
  error.name = "AbortError";
  const fake = model({ promptError: error });
  const result = await nano.refine(payload, { languageModel: fake.api });
  assert.equal(result.fallback, false);
  assert.equal(result.error.code, "CANCELED");
});
