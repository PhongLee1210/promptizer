import { beforeEach, describe, expect, it, vi } from "vitest";
import { ResultWindow, type ResultWindowCallbacks } from "../result-window";
import { initialChipState, reduceChipState, type ChipState, type Outcome } from "../chip-state";

const OK: Outcome = { kind: "ok", title: "Refined prompt", text: "Create a landing page." };

function callbacks(): ResultWindowCallbacks & Record<keyof ResultWindowCallbacks, ReturnType<typeof vi.fn>> {
  return {
    onStep: vi.fn(),
    onDeleteCurrent: vi.fn(),
    onEditStart: vi.fn(),
    onEditDiscard: vi.fn(),
    onEditSave: vi.fn(),
    onTweakToggle: vi.fn(),
    onRunTweak: vi.fn(),
    onRegenerate: vi.fn(),
    onCopy: vi.fn(),
    onReplace: vi.fn(),
    onRetry: vi.fn(),
    onClose: vi.fn(),
  };
}

function withResult(outcome: Outcome = OK, action: "refine" = "refine"): ChipState {
  return reduceChipState(initialChipState, {
    type: "outcome-arrived",
    id: "a",
    action,
    source: "text",
    outcome,
  });
}

function labels(win: ResultWindow): string[] {
  return [...win.node().querySelectorAll("button")].map((b) => b.getAttribute("aria-label") ?? "");
}

function clickByLabel(win: ResultWindow, label: string): void {
  const button = [...win.node().querySelectorAll("button")].find((b) => b.getAttribute("aria-label") === label);
  if (button === undefined) {
    throw new Error(`no button labelled "${label}"`);
  }
  button.click();
}

describe("ResultWindow", () => {
  let spies: ReturnType<typeof callbacks>;
  let win: ResultWindow;

  beforeEach(() => {
    spies = callbacks();
    win = new ResultWindow(spies);
    document.body.replaceChildren(win.node());
  });

  it("stays hidden while closed", () => {
    win.render(initialChipState);
    expect(win.node().dataset.open).toBe("false");
  });

  it("shows a busy skeleton with only a close button while loading", () => {
    const loading = reduceChipState(initialChipState, {
      type: "action-selected",
      action: "grammar",
      source: "text",
      hasText: true,
    });
    win.render(loading);
    expect(win.node().dataset.open).toBe("true");
    expect(win.node().querySelector('[role="status"]')).not.toBeNull();
    expect(labels(win)).toEqual(["Close"]);
  });

  it("shows the result with nav disabled at both bounds on a single entry", () => {
    win.render(withResult());
    expect(labels(win)).toEqual([
      "Previous result",
      "Next result",
      "Delete result",
      "Close",
      "Edit",
      "Tweak",
      "Regenerate",
      "Copy",
      "Replace text",
    ]);
    const prev = win.node().querySelector('[aria-label="Previous result"]') as HTMLButtonElement;
    const next = win.node().querySelector('[aria-label="Next result"]') as HTMLButtonElement;
    expect(prev.disabled).toBe(true);
    expect(next.disabled).toBe(true);
    expect(win.node().querySelector(".pz-win__counter")?.textContent).toBe("1/1");
    expect(win.node().querySelector(".pz-win__body")?.textContent).toBe(OK.text);
  });

  it("enables nav once there is more than one result", () => {
    const two = reduceChipState(withResult(), {
      type: "outcome-arrived",
      id: "b",
      action: "refine",
      source: "text",
      outcome: { kind: "ok", title: "Refined prompt", text: "Second." },
    });
    win.render(two);
    expect(win.node().querySelector(".pz-win__counter")?.textContent).toBe("2/2");
    const prev = win.node().querySelector('[aria-label="Previous result"]') as HTMLButtonElement;
    const next = win.node().querySelector('[aria-label="Next result"]') as HTMLButtonElement;
    expect(prev.disabled).toBe(false);
    expect(next.disabled).toBe(true);
    clickByLabel(win, "Previous result");
    expect(spies.onStep).toHaveBeenCalledWith(-1);
  });

  it("switches to an editable textarea in the editing state and saves its value", () => {
    const editing = reduceChipState(withResult(), { type: "edit-started" });
    win.render(editing);
    const textarea = win.node().querySelector("textarea.pz-win__body") as HTMLTextAreaElement;
    expect(textarea).not.toBeNull();
    expect(textarea.value).toBe(OK.text);
    expect(labels(win)).toEqual([
      "Previous result",
      "Next result",
      "Delete result",
      "Close",
      "Discard edit",
      "Save edit",
    ]);
    textarea.value = "edited";
    clickByLabel(win, "Save edit");
    expect(spies.onEditSave).toHaveBeenCalledWith("edited");
  });

  it("shows the back button and seven tweak leaves in the tweak state", () => {
    const tweaking = reduceChipState(withResult(), { type: "tweak-toggled" });
    win.render(tweaking);
    expect(labels(win)).toEqual([
      "Previous result",
      "Next result",
      "Delete result",
      "Close",
      "Back",
      "Shorten",
      "Fix grammar",
      "Professional",
      "Friendly",
      "Direct",
      "Vietnamese",
      "English",
    ]);
    clickByLabel(win, "Shorten");
    expect(spies.onRunTweak).toHaveBeenCalledWith("shorten");
    clickByLabel(win, "Back");
    expect(spies.onTweakToggle).toHaveBeenCalled();
  });

  it("raises an alert with a single Try again control on error", () => {
    const failed = reduceChipState(initialChipState, {
      type: "outcome-arrived",
      id: "a",
      action: "grammar",
      source: "text",
      outcome: { kind: "error", message: "Couldn't get a result. Your text is unchanged." },
    });
    win.render(failed);
    expect(win.node().querySelector('[role="alert"]')?.textContent).toBe(
      "Couldn't get a result. Your text is unchanged.",
    );
    expect(labels(win)).toEqual(["Close", "Try again"]);
    clickByLabel(win, "Try again");
    expect(spies.onRetry).toHaveBeenCalled();
  });

  it("renders text content, never markup, in the result body", () => {
    const malicious = withResult({ kind: "ok", title: "Refined prompt", text: "<img src=x onerror=alert(1)>" });
    win.render(malicious);
    expect(win.node().querySelector(".pz-win__body")?.textContent).toBe("<img src=x onerror=alert(1)>");
    expect(win.node().querySelector("img")).toBeNull();
  });

  it("shows an Edited badge only after a save actually changes the text", () => {
    const withResultState = withResult();
    win.render(withResultState);
    expect(win.node().querySelector(".pz-win__edited")).toBeNull();

    const edited = reduceChipState(reduceChipState(withResultState, { type: "edit-started" }), {
      type: "edit-saved",
      text: "changed",
    });
    win.render(edited);
    expect(win.node().querySelector(".pz-win__edited")?.textContent).toBe("Edited");
  });

  it("leaves no controls from a previous view behind", () => {
    win.render(withResult());
    const tweaking = reduceChipState(withResult(), { type: "tweak-toggled" });
    win.render(tweaking);
    expect(labels(win)).not.toContain("Replace text");
  });
});
