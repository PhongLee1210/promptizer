import { describe, expect, it, vi } from "vitest";
import { performAction, type ActionRouterDependencies } from "../action-router";
import type { RefineResult } from "../action-types";

function dependencies(overrides: Partial<ActionRouterDependencies> = {}): ActionRouterDependencies {
  return {
    refineWithNano: vi.fn<ActionRouterDependencies["refineWithNano"]>().mockResolvedValue({ decision: "error" }),
    ...overrides,
  };
}

describe("performAction", () => {
  it("returns the Nano result directly when Nano succeeds", async () => {
    const nanoResult: RefineResult = { decision: "refine", refinedText: "From Nano." };
    const deps = dependencies({ refineWithNano: vi.fn().mockResolvedValue(nanoResult) });

    const result = await performAction(deps)("refine", "draft");

    expect(result).toEqual(nanoResult);
  });

  it("returns a Nano keep result as-is", async () => {
    const deps = dependencies({ refineWithNano: vi.fn().mockResolvedValue({ decision: "keep" }) });

    const result = await performAction(deps)("refine", "already clear");

    expect(result).toEqual({ decision: "keep" });
  });

  it("returns the Nano error result as-is for every action", async () => {
    const deps = dependencies();

    const result = await performAction(deps)("refine", "draft");

    expect(result).toEqual({ decision: "error" });
  });

  it.each(["vi", "improve", "grammar", "shorten", "en", "pro", "friendly", "direct"] as const)(
    "returns the Nano error result as-is for %s",
    async (action) => {
      const deps = dependencies();

      const result = await performAction(deps)(action, "draft");

      expect(result).toEqual({ decision: "error" });
    },
  );
});
