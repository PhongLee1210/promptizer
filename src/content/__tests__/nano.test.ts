import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  evictWarmSessions,
  nanoAvailability,
  prewarmNano,
  refineWithNano,
  type LanguageModelApi,
  type LanguageModelSession,
} from "../nano";

beforeEach(() => {
  evictWarmSessions();
});

function fakeSession(promptResult: string): LanguageModelSession & { destroy: ReturnType<typeof vi.fn> } {
  return {
    prompt: vi.fn().mockResolvedValue(promptResult),
    destroy: vi.fn(),
  };
}

function fakeClonableSession(
  promptResult: string,
): LanguageModelSession & { destroy: ReturnType<typeof vi.fn>; clone: ReturnType<typeof vi.fn> } {
  const template = {
    prompt: vi.fn().mockResolvedValue(promptResult),
    destroy: vi.fn(),
    clone: vi.fn(),
  };
  template.clone.mockImplementation(async () => ({
    prompt: vi.fn().mockResolvedValue(promptResult),
    destroy: vi.fn(),
  }));
  return template;
}

function fakeLanguageModel(
  availability: "available" | "downloadable" | "downloading" | "unavailable",
  session: LanguageModelSession,
): LanguageModelApi {
  return {
    availability: vi.fn().mockResolvedValue(availability),
    create: vi.fn().mockResolvedValue(session),
  };
}

describe("nanoAvailability", () => {
  it("is unavailable when no LanguageModel global exists", async () => {
    expect(await nanoAvailability(undefined)).toBe("unavailable");
  });

  it("reports whatever the real API reports", async () => {
    const languageModel = fakeLanguageModel("downloadable", fakeSession("{}"));
    expect(await nanoAvailability(languageModel)).toBe("downloadable");
  });

  it("is unavailable if the availability check throws", async () => {
    const languageModel: LanguageModelApi = {
      availability: vi.fn().mockRejectedValue(new Error("boom")),
      create: vi.fn(),
    };
    expect(await nanoAvailability(languageModel)).toBe("unavailable");
  });
});

describe("refineWithNano", () => {
  it("errors when no LanguageModel global exists", async () => {
    const result = await refineWithNano("refine", "some long enough draft text", {});
    expect(result.decision).toBe("error");
  });

  it("errors when Nano is not available yet", async () => {
    const languageModel = fakeLanguageModel("downloading", fakeSession("{}"));
    const result = await refineWithNano("refine", "draft", { languageModel });
    expect(result.decision).toBe("error");
    expect(languageModel.create).not.toHaveBeenCalled();
  });

  it("returns the refined text on a successful refine decision", async () => {
    const session = fakeSession(JSON.stringify({ decision: "refine", refined_prompt: "Draft, refined." }));
    const languageModel = fakeLanguageModel("available", session);

    const result = await refineWithNano("refine", "draft", { languageModel });

    expect(result).toEqual({ decision: "refine", refinedText: "Draft, refined." });
    expect(session.destroy).toHaveBeenCalledTimes(1);
  });

  it("returns keep with no refinedText when the model says the draft is already clear", async () => {
    const session = fakeSession(JSON.stringify({ decision: "keep", refined_prompt: "ignored" }));
    const languageModel = fakeLanguageModel("available", session);

    const result = await refineWithNano("refine", "Already clear draft.", { languageModel });

    expect(result).toEqual({ decision: "keep" });
  });

  it("rejects output that is not a single clean paragraph", async () => {
    const session = fakeSession(JSON.stringify({ decision: "refine", refined_prompt: "- a bullet point" }));
    const languageModel = fakeLanguageModel("available", session);

    const result = await refineWithNano("refine", "draft", { languageModel });

    expect(result.decision).toBe("error");
  });

  it("errors if the model response is not valid JSON", async () => {
    const session = fakeSession("not json");
    const languageModel = fakeLanguageModel("available", session);

    const result = await refineWithNano("refine", "draft", { languageModel });

    expect(result.decision).toBe("error");
    expect(session.destroy).toHaveBeenCalledTimes(1);
  });

  it("uses a Vietnamese-specific instruction for the vi action", async () => {
    const session = fakeSession(JSON.stringify({ decision: "refine", refined_prompt: "Xin chào thế giới." }));
    const languageModel = fakeLanguageModel("available", session);

    await refineWithNano("vi", "hello world", { languageModel });

    const createCall = (languageModel.create as ReturnType<typeof vi.fn>).mock.calls[0]![0];
    const systemContent = createCall.initialPrompts[0].content as string;
    expect(systemContent).toContain("Translate");
    expect(systemContent).toContain("Vietnamese");
  });

  it("uses an English-specific instruction for the en action", async () => {
    const session = fakeSession(JSON.stringify({ decision: "refine", refined_prompt: "Hello world." }));
    const languageModel = fakeLanguageModel("available", session);

    await refineWithNano("en", "hola mundo", { languageModel });

    const createCall = (languageModel.create as ReturnType<typeof vi.fn>).mock.calls[0]![0];
    const systemContent = createCall.initialPrompts[0].content as string;
    expect(systemContent).toContain("Translate");
    expect(systemContent).toContain("English");
  });

  it("uses an improve-specific instruction distinct from the refine instruction", async () => {
    const session = fakeSession(JSON.stringify({ decision: "refine", refined_prompt: "Improved." }));
    const languageModel = fakeLanguageModel("available", session);

    await refineWithNano("improve", "draft", { languageModel });

    const createCall = (languageModel.create as ReturnType<typeof vi.fn>).mock.calls[0]![0];
    const systemContent = createCall.initialPrompts[0].content as string;
    expect(systemContent).toContain("specific and actionable");
  });

  it("uses a grammar-specific instruction", async () => {
    const session = fakeSession(JSON.stringify({ decision: "refine", refined_prompt: "Fixed." }));
    const languageModel = fakeLanguageModel("available", session);

    await refineWithNano("grammar", "draft", { languageModel });

    const createCall = (languageModel.create as ReturnType<typeof vi.fn>).mock.calls[0]![0];
    expect(createCall.initialPrompts[0].content as string).toContain("grammar");
  });

  it("uses a shorten-specific instruction", async () => {
    const session = fakeSession(JSON.stringify({ decision: "refine", refined_prompt: "Short." }));
    const languageModel = fakeLanguageModel("available", session);

    await refineWithNano("shorten", "draft", { languageModel });

    const createCall = (languageModel.create as ReturnType<typeof vi.fn>).mock.calls[0]![0];
    expect(createCall.initialPrompts[0].content as string).toContain("Shorten");
  });

  it.each(["pro", "friendly", "direct"] as const)("uses a %s tone-specific instruction", async (tone) => {
    const session = fakeSession(JSON.stringify({ decision: "refine", refined_prompt: "Rewritten." }));
    const languageModel = fakeLanguageModel("available", session);

    await refineWithNano(tone, "draft", { languageModel });

    const createCall = (languageModel.create as ReturnType<typeof vi.fn>).mock.calls[0]![0];
    expect(createCall.initialPrompts[0].content as string).toContain("tone");
  });
});

describe("warm session reuse", () => {
  it("creates one template and clones it for each request", async () => {
    const template = fakeClonableSession(JSON.stringify({ decision: "refine", refined_prompt: "Draft, refined." }));
    const languageModel = fakeLanguageModel("available", template);

    await refineWithNano("refine", "draft", { languageModel });
    await refineWithNano("refine", "another draft", { languageModel });

    expect(languageModel.create).toHaveBeenCalledTimes(1);
    expect(template.clone).toHaveBeenCalledTimes(2);
    expect(template.destroy).not.toHaveBeenCalled();
  });

  it("checks availability once after the first available verdict", async () => {
    const template = fakeClonableSession(JSON.stringify({ decision: "keep", refined_prompt: "ignored" }));
    const languageModel = fakeLanguageModel("available", template);

    await refineWithNano("refine", "draft", { languageModel });
    await refineWithNano("refine", "draft", { languageModel });

    expect(languageModel.availability).toHaveBeenCalledTimes(1);
  });

  it("keeps separate templates per action", async () => {
    const template = fakeClonableSession(JSON.stringify({ decision: "refine", refined_prompt: "Improved." }));
    const languageModel = fakeLanguageModel("available", template);

    await refineWithNano("refine", "draft", { languageModel });
    await refineWithNano("improve", "draft", { languageModel });
    await refineWithNano("improve", "draft", { languageModel });

    expect(languageModel.create).toHaveBeenCalledTimes(2);
  });

  it("keeps separate templates per translation action", async () => {
    const template = fakeClonableSession(JSON.stringify({ decision: "refine", refined_prompt: "Hola." }));
    const languageModel = fakeLanguageModel("available", template);

    await refineWithNano("vi", "hello world", { languageModel });
    await refineWithNano("en", "hello world", { languageModel });

    expect(languageModel.create).toHaveBeenCalledTimes(2);
  });

  it("falls back to a fresh session per request when clone() is unavailable", async () => {
    const session = fakeSession(JSON.stringify({ decision: "refine", refined_prompt: "Draft, refined." }));
    const languageModel = fakeLanguageModel("available", session);

    const first = await refineWithNano("refine", "draft", { languageModel });
    await refineWithNano("refine", "draft", { languageModel });

    expect(first).toEqual({ decision: "refine", refinedText: "Draft, refined." });
    expect(languageModel.create).toHaveBeenCalledTimes(2);
  });

  it("drops the cached template and availability verdict after a session failure", async () => {
    const template = fakeClonableSession("{}");
    template.clone.mockRejectedValue(new Error("session gone"));
    const languageModel = fakeLanguageModel("available", template);

    const result = await refineWithNano("refine", "draft", { languageModel });

    expect(result.decision).toBe("error");
    expect(template.destroy).toHaveBeenCalledTimes(1);
    expect(languageModel.availability).toHaveBeenCalledTimes(1);

    await refineWithNano("refine", "draft", { languageModel });
    expect(languageModel.availability).toHaveBeenCalledTimes(2);
  });

  it("keeps the template when a request is cancelled", async () => {
    const template = fakeClonableSession("{}");
    template.clone.mockRejectedValue(new Error("aborted"));
    const languageModel = fakeLanguageModel("available", template);
    const controller = new AbortController();
    controller.abort();

    await refineWithNano("refine", "draft", { languageModel, signal: controller.signal });

    expect(template.destroy).not.toHaveBeenCalled();
  });
});

describe("template eviction", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("destroys an idle template after the idle window", async () => {
    const template = fakeClonableSession(JSON.stringify({ decision: "keep", refined_prompt: "ignored" }));
    const languageModel = fakeLanguageModel("available", template);

    await refineWithNano("refine", "draft", { languageModel });
    vi.advanceTimersByTime(180_000);
    await vi.runAllTicks();

    expect(template.destroy).toHaveBeenCalledTimes(1);
  });

  it("keeps the template alive while requests keep arriving", async () => {
    const template = fakeClonableSession(JSON.stringify({ decision: "keep", refined_prompt: "ignored" }));
    const languageModel = fakeLanguageModel("available", template);

    await refineWithNano("refine", "draft", { languageModel });
    vi.advanceTimersByTime(120_000);
    await refineWithNano("refine", "draft", { languageModel });
    vi.advanceTimersByTime(120_000);

    expect(template.destroy).not.toHaveBeenCalled();
  });
});

describe("prewarmNano", () => {
  it("builds the refine template before any request runs", async () => {
    const template = fakeClonableSession(JSON.stringify({ decision: "keep", refined_prompt: "ignored" }));
    const languageModel = fakeLanguageModel("available", template);

    await prewarmNano("refine", { languageModel });
    await refineWithNano("refine", "draft", { languageModel });

    expect(languageModel.create).toHaveBeenCalledTimes(1);
    expect(template.clone).toHaveBeenCalledTimes(1);
  });

  it("never creates a session while the model is only downloadable", async () => {
    const languageModel = fakeLanguageModel("downloadable", fakeClonableSession("{}"));

    await prewarmNano("refine", { languageModel });

    expect(languageModel.create).not.toHaveBeenCalled();
  });

  it("does nothing when no LanguageModel global exists", async () => {
    await expect(prewarmNano()).resolves.toBeUndefined();
  });
});
