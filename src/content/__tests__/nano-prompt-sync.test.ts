import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { REFINE_SYSTEM_INSTRUCTION } from "../nano";

describe("REFINE_SYSTEM_INSTRUCTION", () => {
  it("matches the system prompt the Go backend sends to Groq, word for word", () => {
    const goPromptPath = resolve(__dirname, "../../../internal/refine/prompt.go");
    const goSource = readFileSync(goPromptPath, "utf8");
    const match = /const systemPrompt = `([^`]+)`/.exec(goSource);
    expect(match).not.toBeNull();
    const goSystemPrompt = match![1]!;

    expect(goSystemPrompt.startsWith(REFINE_SYSTEM_INSTRUCTION)).toBe(true);
  });
});
