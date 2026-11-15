import { describe, expect, it, vi } from "vitest";
import { performAction, type ActionRouterDependencies } from "../action-router";
import type { RefineResult } from "../action-types";

function dependencies(overrides: Partial<ActionRouterDependencies> = {}): ActionRouterDependencies {
  return {
    refineWithNano: vi.fn<ActionRouterDependencies["refineWithNano"]>().mockResolvedValue({ decision: "error" }),
    refineViaGroqLoopback: vi
      .fn<ActionRouterDependencies["refineViaGroqLoopback"]>()
      .mockResolvedValue({ decision: "error" }),
    ...overrides,
  };
}

describe("performAction", () => {
  it("returns the Nano result directly when Nano succeeds", async () => {
    const nanoResult: RefineResult = { decision: "refine", refinedText: "From Nano." };
    const deps = dependencies({ refineWithNano: vi.fn().mockResolvedValue(nanoResult) });

    const result = await performAction(deps)("refine", "draft");

    expect(result).toEqual(nanoResult);
    expect(deps.refineViaGroqLoopback).not.toHaveBeenCalled();
  });

  it("returns a Nano keep result without falling back to Groq", async () => {
    const deps = dependencies({ refineWithNano: vi.fn().mockResolvedValue({ decision: "keep" }) });

    const result = await performAction(deps)("refine", "already clear");

    expect(result).toEqual({ decision: "keep" });
    expect(deps.refineViaGroqLoopback).not.toHaveBeenCalled();
  });

  it("falls back to Groq for the refine action when Nano errors", async () => {
    const groqResult: RefineResult = { decision: "refine", refinedText: "From Groq." };
    const deps = dependencies({ refineViaGroqLoopback: vi.fn().mockResolvedValue(groqResult) });

    const result = await performAction(deps)("refine", "draft");

    expect(result).toEqual(groqResult);
    expect(deps.refineViaGroqLoopback).toHaveBeenCalledWith("draft");
  });

  it("does not fall back to Groq for translate when Nano errors, since the Go backend has no translate endpoint", async () => {
    const deps = dependencies();

    const result = await performAction(deps)("translate", "draft", "Spanish");

    expect(result).toEqual({ decision: "error" });
    expect(deps.refineViaGroqLoopback).not.toHaveBeenCalled();
  });

  it("does not fall back to Groq for improve when Nano errors", async () => {
    const deps = dependencies();

    const result = await performAction(deps)("improve", "draft");

    expect(result).toEqual({ decision: "error" });
    expect(deps.refineViaGroqLoopback).not.toHaveBeenCalled();
  });
});
