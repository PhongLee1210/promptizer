import { describe, expect, it } from "vitest";
import { presentResult } from "../present-result";
import type { ActionId, RefineResult } from "../action-types";

const DRAFT = "make a landing page";

function present(action: ActionId, result: RefineResult, originalText = DRAFT) {
  return presentResult({ action, result, originalText });
}

describe("presentResult", () => {
  it("shows a refined draft as a result", () => {
    expect(present("refine", { decision: "refine", refinedText: "Create a landing page." })).toEqual({
      kind: "ok",
      title: "Refined prompt",
      text: "Create a landing page.",
    });
  });

  it.each([
    ["improve", "Improved"],
    ["grammar", "Grammar fixed"],
    ["shorten", "Shortened"],
    ["vi", "Vietnamese"],
    ["en", "English"],
    ["pro", "Professional tone"],
    ["friendly", "Friendly tone"],
    ["direct", "Direct tone"],
  ] as [ActionId, string][])("titles a %s result as %s", (action, title) => {
    const view = present(action, { decision: "refine", refinedText: "Rewritten." });
    expect(view).toEqual({ kind: "ok", title, text: "Rewritten." });
  });

  it("falls back to the original text on a keep decision", () => {
    expect(present("refine", { decision: "keep" })).toEqual({
      kind: "ok",
      title: "Refined prompt",
      text: DRAFT,
    });
  });

  it("falls back to the original text when the suggestion is empty or missing", () => {
    expect(present("refine", { decision: "refine", refinedText: "   " })).toEqual({
      kind: "ok",
      title: "Refined prompt",
      text: DRAFT,
    });
    expect(present("refine", { decision: "refine" })).toEqual({
      kind: "ok",
      title: "Refined prompt",
      text: DRAFT,
    });
  });

  it("reports a single uniform error message regardless of action", () => {
    expect(present("refine", { decision: "error" })).toEqual({
      kind: "error",
      message: "Couldn't get a result. Your text is unchanged.",
    });
    expect(present("shorten", { decision: "error" })).toEqual({
      kind: "error",
      message: "Couldn't get a result. Your text is unchanged.",
    });
  });
});
