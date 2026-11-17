import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fakeBrowser } from "wxt/testing/fake-browser";
import { startChipController } from "../controller";
import type { RefineResult } from "../action-types";

const LONG_DRAFT = "this is a draft";
const REFINED_DRAFT = "This is a draft, refined.";

function chipHost(): HTMLElement | null {
  return document.querySelector("[data-promptizer-pill]");
}

function chipShadow(): ShadowRoot {
  return chipHost()!.shadowRoot!;
}

function trigger(): HTMLButtonElement {
  return chipShadow().querySelector('[aria-label="Promptizer actions"]') as HTMLButtonElement;
}

function railNode(): HTMLElement {
  return chipShadow().querySelector(".pz-rail") as HTMLElement;
}

function isRailOpen(): boolean {
  return railNode().dataset.open === "true";
}

function winNode(): HTMLElement {
  return chipShadow().querySelector(".pz-win") as HTMLElement;
}

function isWindowOpen(): boolean {
  return winNode().dataset.open === "true";
}

function railItems(): HTMLButtonElement[] {
  return [...railNode().querySelectorAll('[role="menuitem"]')].filter(
    (node) => node.closest(".pz-rail__strip") === null,
  ) as HTMLButtonElement[];
}

function clickRailItem(label: string): void {
  (railNode().querySelector(`[aria-label="${label}"]`) as HTMLButtonElement | null)?.click();
}

function winButtonLabels(): string[] {
  return [...winNode().querySelectorAll("button")].map((b) => b.getAttribute("aria-label") ?? "");
}

function clickWinButton(label: string): void {
  (winNode().querySelector(`[aria-label="${label}"]`) as HTMLButtonElement | null)?.click();
}

function winBodyText(): string {
  return chipShadow().querySelector(".pz-win__body")?.textContent ?? "";
}

function winCounter(): string {
  return chipShadow().querySelector(".pz-win__counter")?.textContent ?? "";
}

function refineResult(refinedText = REFINED_DRAFT): ReturnType<typeof vi.fn> {
  return vi.fn<(...args: unknown[]) => Promise<RefineResult>>().mockResolvedValue({ decision: "refine", refinedText });
}

function focusedTextarea(value = ""): HTMLTextAreaElement {
  const textarea = document.createElement("textarea");
  textarea.value = value;
  document.body.append(textarea);
  return textarea;
}

function focusedComposer(value = ""): HTMLDivElement {
  const div = document.createElement("div");
  div.contentEditable = "true";
  div.textContent = value;
  document.body.append(div);
  return div;
}

const realAttachShadow = Element.prototype.attachShadow;

describe("startChipController", () => {
  let stop: () => void;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(Element.prototype, "attachShadow").mockImplementation(function (this: Element, init: ShadowRootInit) {
      return realAttachShadow.call(this, { ...init, mode: "open" });
    });
  });

  afterEach(() => {
    stop?.();
    document.body.innerHTML = "";
    vi.useRealTimers();
    vi.unstubAllGlobals();
    fakeBrowser.reset();
  });

  it("creates exactly one chip host even if focus fires repeatedly", () => {
    const textarea = focusedTextarea();
    stop = startChipController();

    textarea.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
    textarea.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));

    expect(document.querySelectorAll("[data-promptizer-pill]")).toHaveLength(1);
  });

  it("shows a closed chip as soon as the editor is focused", () => {
    const textarea = focusedTextarea();
    stop = startChipController();

    textarea.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));

    expect(chipHost()!.style.display).toBe("block");
    expect(trigger().getAttribute("aria-expanded")).toBe("false");
    expect(isRailOpen()).toBe(false);
    expect(isWindowOpen()).toBe(false);
  });

  it("shows the chip for an editor that is already focused when the controller starts", () => {
    const textarea = focusedTextarea();
    textarea.focus();

    stop = startChipController();

    expect(chipHost()!.style.display).toBe("block");
  });

  it("opens the rail on click, leading with Improve writing for a plain text field", () => {
    const textarea = focusedTextarea();
    stop = startChipController();

    textarea.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
    trigger().click();

    expect(isRailOpen()).toBe(true);
    expect(trigger().getAttribute("aria-expanded")).toBe("true");
    expect(railItems().map((item) => item.getAttribute("aria-label"))).toEqual([
      "Improve writing",
      "Fix grammar",
      "Shorten",
      "Translate",
      "Change tone",
      "Turn off",
    ]);
  });

  it("leads with Refine prompt for a contenteditable composer", () => {
    const composer = focusedComposer();
    stop = startChipController();

    composer.dispatchEvent(new FocusEvent("focusin", { bubbles: true, composed: true }));
    trigger().click();

    expect(railItems()[0]?.getAttribute("aria-label")).toBe("Refine prompt");
  });

  it("runs an action and shows the result window", async () => {
    const textarea = focusedTextarea(LONG_DRAFT);
    const performAction = refineResult();
    stop = startChipController({ performAction });

    textarea.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
    trigger().click();
    clickRailItem("Fix grammar");

    expect(trigger().dataset.loading).toBe("true");
    await vi.advanceTimersByTimeAsync(1);

    expect(performAction).toHaveBeenCalledWith("grammar", LONG_DRAFT);
    expect(trigger().dataset.loading).toBe("false");
    expect(isWindowOpen()).toBe(true);
    expect(winBodyText()).toBe(REFINED_DRAFT);
    expect(winButtonLabels()).toEqual([
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
  });

  it("keeps the draft untouched until Replace text is clicked", async () => {
    const textarea = focusedTextarea(LONG_DRAFT);
    stop = startChipController({ performAction: refineResult() });

    textarea.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
    trigger().click();
    clickRailItem("Fix grammar");
    await vi.advanceTimersByTimeAsync(1);
    expect(textarea.value).toBe(LONG_DRAFT);

    clickWinButton("Replace text");
    expect(textarea.value).toBe(REFINED_DRAFT);
    expect(isWindowOpen()).toBe(false);
  });

  it("offers an undo chip for six seconds after a replace, then withdraws it", async () => {
    const textarea = focusedTextarea(LONG_DRAFT);
    stop = startChipController({ performAction: refineResult() });

    textarea.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
    trigger().click();
    clickRailItem("Fix grammar");
    await vi.advanceTimersByTimeAsync(1);
    clickWinButton("Replace text");

    const undo = chipShadow().querySelector('[aria-label="Undo replace"]') as HTMLButtonElement;
    expect(undo.hidden).toBe(false);
    undo.click();
    expect(textarea.value).toBe(LONG_DRAFT);
    expect(undo.hidden).toBe(true);

    trigger().click();
    clickRailItem("Recent results");
    clickWinButton("Replace text");
    expect((chipShadow().querySelector('[aria-label="Undo replace"]') as HTMLButtonElement).hidden).toBe(false);
    await vi.advanceTimersByTimeAsync(6000);
    expect((chipShadow().querySelector('[aria-label="Undo replace"]') as HTMLButtonElement).hidden).toBe(true);
    expect(textarea.value).toBe(REFINED_DRAFT);
  });

  it("edits a result in place and saves it", async () => {
    const textarea = focusedTextarea(LONG_DRAFT);
    stop = startChipController({ performAction: refineResult() });

    textarea.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
    trigger().click();
    clickRailItem("Fix grammar");
    await vi.advanceTimersByTimeAsync(1);

    clickWinButton("Edit");
    const textareaField = chipShadow().querySelector("textarea.pz-win__body") as HTMLTextAreaElement;
    expect(textareaField.value).toBe(REFINED_DRAFT);
    textareaField.value = "Hand-edited result.";
    clickWinButton("Save edit");

    expect(winBodyText()).toBe("Hand-edited result.");
    clickWinButton("Replace text");
    expect(textarea.value).toBe("Hand-edited result.");
  });

  it("discards an edit without changing the result", async () => {
    const textarea = focusedTextarea(LONG_DRAFT);
    stop = startChipController({ performAction: refineResult() });

    textarea.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
    trigger().click();
    clickRailItem("Fix grammar");
    await vi.advanceTimersByTimeAsync(1);

    clickWinButton("Edit");
    clickWinButton("Discard edit");
    expect(winBodyText()).toBe(REFINED_DRAFT);
  });

  it("tweaks a result, pushing a new history entry", async () => {
    const textarea = focusedTextarea(LONG_DRAFT);
    const performAction = vi
      .fn<(...args: unknown[]) => Promise<RefineResult>>()
      .mockResolvedValueOnce({ decision: "refine", refinedText: REFINED_DRAFT })
      .mockResolvedValue({ decision: "refine", refinedText: "Shortened." });
    stop = startChipController({ performAction });

    textarea.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
    trigger().click();
    clickRailItem("Fix grammar");
    await vi.advanceTimersByTimeAsync(1);

    clickWinButton("Tweak");
    expect(winButtonLabels()).toEqual([
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
    clickWinButton("Shorten");
    await vi.advanceTimersByTimeAsync(1);

    expect(performAction).toHaveBeenLastCalledWith("shorten", REFINED_DRAFT);
    expect(winCounter()).toBe("2/2");
    expect(winBodyText()).toBe("Shortened.");
  });

  it("regenerates by rerunning the same action on the current editor text", async () => {
    const textarea = focusedTextarea(LONG_DRAFT);
    const performAction = vi
      .fn<(...args: unknown[]) => Promise<RefineResult>>()
      .mockResolvedValueOnce({ decision: "refine", refinedText: REFINED_DRAFT })
      .mockResolvedValue({ decision: "refine", refinedText: "Second pass." });
    stop = startChipController({ performAction });

    textarea.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
    trigger().click();
    clickRailItem("Fix grammar");
    await vi.advanceTimersByTimeAsync(1);

    clickWinButton("Regenerate");
    await vi.advanceTimersByTimeAsync(1);

    expect(performAction).toHaveBeenLastCalledWith("grammar", LONG_DRAFT);
    expect(winCounter()).toBe("2/2");
  });

  it("steps through history and caps it at 10 results", async () => {
    const textarea = focusedTextarea(LONG_DRAFT);
    const performAction = vi.fn<(...args: unknown[]) => Promise<RefineResult>>().mockImplementation(async () => ({
      decision: "refine",
      refinedText: `result ${performAction.mock.calls.length}`,
    }));
    stop = startChipController({ performAction });

    textarea.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
    for (let i = 0; i < 11; i += 1) {
      trigger().click();
      clickRailItem("Fix grammar");
      await vi.advanceTimersByTimeAsync(1);
      if (i < 10) {
        trigger().click();
      }
    }

    expect(winCounter()).toBe("10/10");
    clickWinButton("Previous result");
    expect(winCounter()).toBe("9/10");
  });

  it("deletes the current result and closes the window once empty", async () => {
    const textarea = focusedTextarea(LONG_DRAFT);
    stop = startChipController({ performAction: refineResult() });

    textarea.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
    trigger().click();
    clickRailItem("Fix grammar");
    await vi.advanceTimersByTimeAsync(1);

    clickWinButton("Delete result");
    expect(isWindowOpen()).toBe(false);
  });

  it("shows an error with Try again, and retries the same action", async () => {
    const textarea = focusedTextarea(LONG_DRAFT);
    const performAction = vi
      .fn<(...args: unknown[]) => Promise<RefineResult>>()
      .mockResolvedValueOnce({ decision: "error" })
      .mockResolvedValue({ decision: "refine", refinedText: REFINED_DRAFT });
    stop = startChipController({ performAction });

    textarea.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
    trigger().click();
    clickRailItem("Shorten");
    await vi.advanceTimersByTimeAsync(1);

    expect(chipShadow().querySelector('[role="alert"]')?.textContent).toBe(
      "Couldn't get a result. Your text is unchanged.",
    );
    expect(winButtonLabels()).toEqual(["Close", "Try again"]);

    clickWinButton("Try again");
    await vi.advanceTimersByTimeAsync(1);

    expect(performAction).toHaveBeenNthCalledWith(2, "shorten", LONG_DRAFT);
    expect(winBodyText()).toBe(REFINED_DRAFT);
  });

  it("shows recent results only once history exists, and reopens at the newest", async () => {
    const textarea = focusedTextarea(LONG_DRAFT);
    stop = startChipController({ performAction: refineResult() });

    textarea.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
    trigger().click();
    expect(railItems().map((item) => item.getAttribute("aria-label"))).not.toContain("Recent results");

    clickRailItem("Fix grammar");
    await vi.advanceTimersByTimeAsync(1);
    clickWinButton("Close");

    trigger().click();
    expect(railItems().map((item) => item.getAttribute("aria-label"))).toContain("Recent results");
    clickRailItem("Recent results");
    expect(isWindowOpen()).toBe(true);
    expect(winBodyText()).toBe(REFINED_DRAFT);
  });

  it("shows an error instead of running the action when the editor is empty", () => {
    const textarea = focusedTextarea();
    const performAction = vi.fn<(...args: unknown[]) => Promise<RefineResult>>();
    stop = startChipController({ performAction });

    textarea.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
    trigger().click();
    clickRailItem("Fix grammar");

    expect(performAction).not.toHaveBeenCalled();
    expect(isWindowOpen()).toBe(true);
    expect(chipShadow().querySelector('[role="alert"]')?.textContent).toBe("Type something first.");
  });

  it("cancels a running action via the window's close button, returning to the rail", async () => {
    const textarea = focusedTextarea(LONG_DRAFT);
    const performAction = vi.fn<(...args: unknown[]) => Promise<RefineResult>>().mockReturnValue(new Promise(() => {}));
    stop = startChipController({ performAction });

    textarea.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
    trigger().click();
    clickRailItem("Fix grammar");
    clickWinButton("Close");

    expect(isWindowOpen()).toBe(false);
    expect(isRailOpen()).toBe(true);
  });

  it("closes the rail when clicking outside the chip", () => {
    const textarea = focusedTextarea();
    stop = startChipController();

    textarea.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
    trigger().click();
    expect(isRailOpen()).toBe(true);

    document.body.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(isRailOpen()).toBe(false);
  });

  it("keeps a run going and still shows the result when the user clicks away mid-run", async () => {
    const textarea = focusedTextarea(LONG_DRAFT);
    stop = startChipController({ performAction: refineResult() });

    textarea.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
    trigger().click();
    clickRailItem("Fix grammar");

    document.body.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    textarea.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));

    await vi.advanceTimersByTimeAsync(1);

    expect(isWindowOpen()).toBe(true);
    expect(winBodyText()).toBe(REFINED_DRAFT);
  });

  it("Escape leaves edit mode first, then closes the window, returning focus to the chip", async () => {
    const textarea = focusedTextarea(LONG_DRAFT);
    stop = startChipController({ performAction: refineResult() });

    textarea.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
    trigger().click();
    clickRailItem("Fix grammar");
    await vi.advanceTimersByTimeAsync(1);
    clickWinButton("Edit");

    trigger().dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(isWindowOpen()).toBe(true);
    expect(winBodyText()).toBe(REFINED_DRAFT);

    trigger().dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(isWindowOpen()).toBe(false);
    expect(chipShadow().activeElement).toBe(trigger());
  });

  it("Escape closes an open strip before closing the rail", () => {
    const textarea = focusedTextarea();
    stop = startChipController();

    textarea.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
    trigger().click();
    clickRailItem("Change tone");
    expect(railNode().querySelector(".pz-rail__strip")).not.toBeNull();

    trigger().dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(isRailOpen()).toBe(true);
    expect(railNode().querySelector(".pz-rail__strip")).toBeNull();

    trigger().dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(isRailOpen()).toBe(false);
  });

  it("moves focus into the rail when it opens, and to Replace text once a result loads", async () => {
    const textarea = focusedTextarea(LONG_DRAFT);
    stop = startChipController({ performAction: refineResult() });

    textarea.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
    trigger().click();
    expect(chipShadow().activeElement?.getAttribute("aria-label")).toBe("Improve writing");

    clickRailItem("Fix grammar");
    await vi.advanceTimersByTimeAsync(1);
    expect(chipShadow().activeElement?.getAttribute("aria-label")).toBe("Replace text");
  });

  it("moves focus to Try again after an error", async () => {
    const textarea = focusedTextarea(LONG_DRAFT);
    stop = startChipController({
      performAction: vi.fn<(...args: unknown[]) => Promise<RefineResult>>().mockResolvedValue({ decision: "error" }),
    });

    textarea.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
    trigger().click();
    clickRailItem("Fix grammar");
    await vi.advanceTimersByTimeAsync(1);

    expect(chipShadow().activeElement?.getAttribute("aria-label")).toBe("Try again");
  });

  it("keeps the chip and window visible while the window holds focus after the editor blurs", async () => {
    const textarea = focusedTextarea();
    stop = startChipController();

    textarea.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
    trigger().click();
    textarea.dispatchEvent(new FocusEvent("focusout", { bubbles: true }));
    await vi.advanceTimersByTimeAsync(130);

    expect(chipHost()!.style.display).toBe("block");
    expect(isRailOpen()).toBe(true);
  });

  it("drops a stale result when the action is cancelled mid-flight", async () => {
    const textarea = focusedTextarea(LONG_DRAFT);
    let resolveAction: (result: RefineResult) => void = () => {};
    const performAction = vi
      .fn<(...args: unknown[]) => Promise<RefineResult>>()
      .mockReturnValue(new Promise((resolve) => (resolveAction = resolve)));
    stop = startChipController({ performAction });

    textarea.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
    trigger().click();
    clickRailItem("Fix grammar");
    clickWinButton("Close");

    resolveAction({ decision: "refine", refinedText: REFINED_DRAFT });
    await vi.advanceTimersByTimeAsync(1);

    expect(isWindowOpen()).toBe(false);
    expect(isRailOpen()).toBe(true);
  });

  it("does not cancel a running action when another editor is focused", async () => {
    const textarea = focusedTextarea(LONG_DRAFT);
    const other = focusedTextarea("another draft");
    const performAction = refineResult();
    stop = startChipController({ performAction });

    textarea.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
    trigger().click();
    clickRailItem("Fix grammar");
    other.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
    await vi.advanceTimersByTimeAsync(1);

    expect(performAction).toHaveBeenCalledTimes(1);
    clickWinButton("Replace text");
    expect(textarea.value).toBe(REFINED_DRAFT);
    expect(other.value).toBe("another draft");
  });

  it("drops a pending result when the originating editor is removed", async () => {
    const textarea = focusedTextarea(LONG_DRAFT);
    stop = startChipController({ performAction: refineResult() });

    textarea.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
    trigger().click();
    clickRailItem("Fix grammar");
    await vi.advanceTimersByTimeAsync(1);

    textarea.remove();
    await vi.waitFor(() => expect(chipHost()!.style.display).toBe("none"));
    expect(isWindowOpen()).toBe(false);
  });

  it("hides the chip when the editor is removed from the page", async () => {
    const textarea = focusedTextarea();
    stop = startChipController();

    textarea.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
    expect(chipHost()!.style.display).toBe("block");

    textarea.remove();
    await vi.waitFor(() => expect(chipHost()!.style.display).toBe("none"));
  });

  it("resolves the outermost contenteditable ancestor when a nested node is focused", () => {
    const root = document.createElement("div");
    root.contentEditable = "true";
    const paragraph = document.createElement("p");
    root.append(paragraph);
    document.body.append(root);
    stop = startChipController();

    paragraph.dispatchEvent(new FocusEvent("focusin", { bubbles: true, composed: true }));

    expect(chipHost()!.style.display).toBe("block");
  });

  it("turns off from the rail, hiding the chip and persisting it as disabled in storage", async () => {
    const textarea = focusedTextarea();
    stop = startChipController();
    await vi.advanceTimersByTimeAsync(0);

    textarea.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
    trigger().click();
    clickRailItem("Turn off");
    await vi.advanceTimersByTimeAsync(120);

    expect(chipHost()!.style.display).toBe("none");
    const stored = await fakeBrowser.storage.local.get("popupState");
    expect((stored.popupState as { globalEnabled?: boolean }).globalEnabled).toBe(false);
  });

  it("never shows the chip when storage already says the extension is off", async () => {
    await fakeBrowser.storage.local.set({ popupState: { globalEnabled: false } });
    const textarea = focusedTextarea();
    stop = startChipController();
    await vi.advanceTimersByTimeAsync(0);

    textarea.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));

    expect(chipHost()!.style.display).toBe("none");
  });

  it("reappears once the popup turns the extension back on", async () => {
    await fakeBrowser.storage.local.set({ popupState: { globalEnabled: false } });
    const textarea = focusedTextarea();
    stop = startChipController();
    await vi.advanceTimersByTimeAsync(0);
    textarea.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
    expect(chipHost()!.style.display).toBe("none");

    await fakeBrowser.storage.local.set({ popupState: { globalEnabled: true } });
    await vi.advanceTimersByTimeAsync(0);

    expect(chipHost()!.style.display).toBe("block");
  });
});

describe("startChipController warm-up", () => {
  const realAttachShadowForWarmup = Element.prototype.attachShadow;

  beforeEach(() => {
    vi.spyOn(Element.prototype, "attachShadow").mockImplementation(function (this: Element, init: ShadowRootInit) {
      return realAttachShadowForWarmup.call(this, { ...init, mode: "open" });
    });
  });

  afterEach(() => {
    document.body.innerHTML = "";
    vi.restoreAllMocks();
  });

  it("prewarms Nano as soon as an editor is focused", () => {
    const prewarm = vi.fn();
    const textarea = document.createElement("textarea");
    document.body.append(textarea);
    const stop = startChipController({ prewarm, releaseWarmSessions: vi.fn() });

    textarea.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));

    expect(prewarm).toHaveBeenCalled();
    stop();
  });

  it("does not prewarm before any editor is focused", () => {
    const prewarm = vi.fn();
    const stop = startChipController({ prewarm, releaseWarmSessions: vi.fn() });

    expect(prewarm).not.toHaveBeenCalled();
    stop();
  });

  it("releases warm sessions when the controller stops", () => {
    const releaseWarmSessions = vi.fn();
    const stop = startChipController({ prewarm: vi.fn(), releaseWarmSessions });

    stop();

    expect(releaseWarmSessions).toHaveBeenCalledTimes(1);
  });
});
