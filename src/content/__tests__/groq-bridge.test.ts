import { afterEach, describe, expect, it, vi } from "vitest";
import { fakeBrowser } from "wxt/testing/fake-browser";
import { refineViaGroqLoopback } from "../groq-bridge";

describe("refineViaGroqLoopback", () => {
  afterEach(() => {
    fakeBrowser.reset();
    vi.restoreAllMocks();
  });

  it("sends a PROMPTIZER_GROQ_REFINE message with the prompt text", async () => {
    const sendMessage = vi
      .spyOn(fakeBrowser.runtime, "sendMessage")
      .mockImplementation(async () => ({ ok: true, decision: "refine", refinedPrompt: "Refined." }));

    const result = await refineViaGroqLoopback("draft text");

    expect(sendMessage).toHaveBeenCalledWith({ type: "PROMPTIZER_GROQ_REFINE", prompt: "draft text" });
    expect(result).toEqual({ decision: "refine", refinedText: "Refined." });
  });

  it("maps a keep decision with no refinedText", async () => {
    vi.spyOn(fakeBrowser.runtime, "sendMessage").mockImplementation(async () => ({ ok: true, decision: "keep" }));

    const result = await refineViaGroqLoopback("already clear");

    expect(result).toEqual({ decision: "keep" });
  });

  it("errors when the background reports failure (e.g. unpaired or service down)", async () => {
    vi.spyOn(fakeBrowser.runtime, "sendMessage").mockImplementation(async () => ({ ok: false }));

    const result = await refineViaGroqLoopback("draft");

    expect(result).toEqual({ decision: "error" });
  });

  it("errors when sendMessage itself rejects (no background listener)", async () => {
    vi.spyOn(fakeBrowser.runtime, "sendMessage").mockRejectedValue(new Error("no receiver"));

    const result = await refineViaGroqLoopback("draft");

    expect(result).toEqual({ decision: "error" });
  });
});
