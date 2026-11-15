"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");

const context = vm.createContext({ TextEncoder, TextDecoder });
context.globalThis = context;
vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "core.js"), "utf8"), context);
const core = context.PromptizerCore;

test("explicit minimum and maximum", () => {
  assert.equal(core.explicitEligible("1234567"), false);
  assert.equal(core.explicitEligible("12345678"), true);
  assert.equal(core.explicitEligible("x".repeat(4001)), false);
});

test("live mode threshold", () => {
  assert.equal(core.liveEligible("short two words"), false);
  assert.equal(core.liveEligible("This prompt has enough meaningful text"), true);
});

test("live mode enforces four-second spacing", () => {
  assert.equal(core.liveDelay(1000, 2000), 3000);
  assert.equal(core.liveDelay(1000, 5000), 0);
});

test("Tab accepts only an active suggestion at the end of the focused composer", () => {
  const eligible = {
    key: "Tab",
    suggestionActive: true,
    composerFocused: true,
    caretAtEnd: true,
    composing: false,
  };
  assert.equal(core.canAcceptSuggestion(eligible), true);
  assert.equal(core.canAcceptSuggestion({ ...eligible, caretAtEnd: false }), false);
  assert.equal(core.canAcceptSuggestion({ ...eligible, composerFocused: false }), false);
  assert.equal(core.canAcceptSuggestion({ ...eligible, suggestionActive: false }), false);
  assert.equal(core.canAcceptSuggestion({ ...eligible, shiftKey: true }), false);
  assert.equal(core.canAcceptSuggestion({ ...eligible, metaKey: true }), false);
  assert.equal(core.canAcceptSuggestion({ ...eligible, composing: true }), false);
});

test("UTF-8 context trimming preserves valid text", () => {
  const result = core.trimUTF8("á".repeat(20), 11);
  assert.ok(new TextEncoder().encode(result).length <= 11);
  assert.equal(result.includes("�"), false);
});

test("response validation rejects stale and multiline output", () => {
  assert.equal(
    core.validResponse({ request_id: "old", decision: "refine", refined_prompt: "Valid output." }, "new"),
    false,
  );
  assert.equal(core.validResponse({ request_id: "new", decision: "refine", refined_prompt: "One\nTwo" }, "new"), false);
  assert.equal(
    core.validResponse({ request_id: "new", decision: "refine", refined_prompt: "Valid output." }, "new"),
    true,
  );
});

test("context priority is bounded", () => {
  const result = core.buildContext("summary", "selected text");
  assert.match(result, /^Task summary:/);
  assert.match(result, /Explicitly selected recent turns:/);
  assert.ok(new TextEncoder().encode(result).length <= 2000);
});
