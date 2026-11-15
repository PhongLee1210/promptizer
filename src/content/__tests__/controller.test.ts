import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { startChipController } from "../controller";
import type { RefineResult } from "../action-types";

const LONG_DRAFT = "this is a draft";
const REFINED_DRAFT = "This is a draft, refined.";

function pillHost(): HTMLElement | null {
  return document.querySelector("[data-promptizer-pill]");
}

function pillShadow(): ShadowRoot {
  return pillHost()!.shadowRoot!;
}

function pillButton(): HTMLButtonElement {
  return pillShadow().querySelector(".pz-pill") as HTMLButtonElement;
}

function menuItems(): HTMLButtonElement[] {
  return [...pillShadow().querySelectorAll(".pz-menu__item")] as HTMLButtonElement[];
}

function clickMenuItem(label: string): void {
  const item = menuItems().find((b) => b.textContent === label)!;
  item.click();
}

const realAttachShadow = Element.prototype.attachShadow;

describe("startChipController", () => {
  let stop: () => void;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(Element.prototype, "attachShadow").mockImplementation(function (this: Element, init: ShadowRootInit) {
      return realAttachShadow.call(this, { ...init, mode: "open" });
    });
    vi.stubGlobal("navigator", { ...navigator, languages: ["en-US", "es-ES"], language: "en-US" });
  });

  afterEach(() => {
    stop?.();
    document.body.innerHTML = "";
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("creates exactly one pill host even if focus fires repeatedly", () => {
    const textarea = document.createElement("textarea");
    document.body.append(textarea);
    stop = startChipController();

    textarea.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
    textarea.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));

    expect(document.querySelectorAll("[data-promptizer-pill]")).toHaveLength(1);
  });

  it("shows a collapsed dot as soon as the editor is focused, even with no text", () => {
    const textarea = document.createElement("textarea");
    document.body.append(textarea);
    stop = startChipController();

    textarea.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));

    expect(pillHost()!.style.display).toBe("block");
    expect(pillButton().dataset.mode).toBe("dot");
  });

  it("shows the dot for an editor that is already focused when the controller starts, with no focusin event", () => {
    const textarea = document.createElement("textarea");
    document.body.append(textarea);
    textarea.focus();
    expect(document.activeElement).toBe(textarea);

    stop = startChipController();

    expect(pillHost()!.style.display).toBe("block");
    expect(pillButton().dataset.mode).toBe("dot");
  });

  it("opens a menu with Refine prompt, Translate to <language>, and Improve on click", () => {
    const textarea = document.createElement("textarea");
    document.body.append(textarea);
    stop = startChipController();

    textarea.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
    pillButton().click();

    expect(pillButton().dataset.mode).toBe("menu");
    const labels = menuItems().map((b) => b.textContent);
    expect(labels).toEqual(["Refine prompt", "Translate to Spanish", "Improve"]);
  });

  it("runs the refine action and shows the result with a Replace button", async () => {
    const textarea = document.createElement("textarea");
    textarea.value = LONG_DRAFT;
    document.body.append(textarea);
    const performAction = vi.fn<(...args: unknown[]) => Promise<RefineResult>>().mockResolvedValue({
      decision: "refine",
      refinedText: REFINED_DRAFT,
    });
    stop = startChipController({ performAction });

    textarea.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
    pillButton().click();
    clickMenuItem("Refine prompt");

    expect(pillButton().dataset.mode).toBe("loading");
    await vi.advanceTimersByTimeAsync(1);

    expect(performAction).toHaveBeenCalledWith("refine", LONG_DRAFT, undefined);
    expect(pillButton().dataset.mode).toBe("result");
    expect(pillButton().dataset.result).toBe("refine");
    expect(pillShadow().querySelector(".pz-pill__label")!.textContent).toBe(REFINED_DRAFT);

    const replaceButton = [...pillShadow().querySelectorAll("button")].find((b) => b.textContent === "Replace")!;
    replaceButton.click();
    expect(textarea.value).toBe(REFINED_DRAFT);
    expect(pillButton().dataset.mode).toBe("dot");
  });

  it("shows the full refined text with no truncation, even when it is long", async () => {
    const longRefinedText =
      "This is a much longer refined draft than sixty characters, written out in full so it is " +
      "easy to read and debug without guessing what got cut off at the end.";
    const textarea = document.createElement("textarea");
    textarea.value = LONG_DRAFT;
    document.body.append(textarea);
    const performAction = vi.fn<(...args: unknown[]) => Promise<RefineResult>>().mockResolvedValue({
      decision: "refine",
      refinedText: longRefinedText,
    });
    stop = startChipController({ performAction });

    textarea.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
    pillButton().click();
    clickMenuItem("Refine prompt");
    await vi.advanceTimersByTimeAsync(1);

    expect(pillShadow().querySelector(".pz-pill__label")!.textContent).toBe(longRefinedText);
  });

  it("passes the detected target language to the translate action", async () => {
    const textarea = document.createElement("textarea");
    textarea.value = LONG_DRAFT;
    document.body.append(textarea);
    const performAction = vi.fn<(...args: unknown[]) => Promise<RefineResult>>().mockResolvedValue({
      decision: "refine",
      refinedText: "[Spanish] this is a draft",
    });
    stop = startChipController({ performAction });

    textarea.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
    pillButton().click();
    clickMenuItem("Translate to Spanish");
    await vi.advanceTimersByTimeAsync(1);

    expect(performAction).toHaveBeenCalledWith("translate", LONG_DRAFT, "Spanish");
  });

  it("dismisses a result back to the idle dot without touching the draft", async () => {
    const textarea = document.createElement("textarea");
    textarea.value = LONG_DRAFT;
    document.body.append(textarea);
    const performAction = vi.fn<(...args: unknown[]) => Promise<RefineResult>>().mockResolvedValue({
      decision: "refine",
      refinedText: REFINED_DRAFT,
    });
    stop = startChipController({ performAction });

    textarea.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
    pillButton().click();
    clickMenuItem("Improve");
    await vi.advanceTimersByTimeAsync(1);

    const dismissButton = pillShadow().querySelector('button[aria-label="Dismiss"]') as HTMLButtonElement;
    dismissButton.click();

    expect(textarea.value).toBe(LONG_DRAFT);
    expect(pillButton().dataset.mode).toBe("dot");
    expect(pillHost()!.style.display).toBe("block");
  });

  it("shows a keep result with no Replace action when the draft is already clear", async () => {
    const textarea = document.createElement("textarea");
    textarea.value = "Already clear.";
    document.body.append(textarea);
    const performAction = vi
      .fn<(...args: unknown[]) => Promise<RefineResult>>()
      .mockResolvedValue({ decision: "keep" });
    stop = startChipController({ performAction });

    textarea.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
    pillButton().click();
    clickMenuItem("Refine prompt");
    await vi.advanceTimersByTimeAsync(1);

    expect(pillButton().dataset.result).toBe("keep");
    const replaceButton = [...pillShadow().querySelectorAll("button")].find(
      (b) => b.textContent === "Replace",
    ) as HTMLButtonElement;
    expect(replaceButton.hidden).toBe(true);
  });

  it("does not open a result for an empty editor", () => {
    const textarea = document.createElement("textarea");
    document.body.append(textarea);
    const performAction = vi.fn<(...args: unknown[]) => Promise<RefineResult>>();
    stop = startChipController({ performAction });

    textarea.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
    pillButton().click();
    clickMenuItem("Refine prompt");

    expect(performAction).not.toHaveBeenCalled();
    expect(pillButton().dataset.mode).toBe("dot");
  });

  it("closes the menu when clicking outside the pill", () => {
    const textarea = document.createElement("textarea");
    document.body.append(textarea);
    stop = startChipController();

    textarea.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
    pillButton().click();
    expect(pillButton().dataset.mode).toBe("menu");

    document.body.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(pillButton().dataset.mode).toBe("dot");
  });

  it("hides the pill once the editor loses focus, unless the menu is open", async () => {
    const textarea = document.createElement("textarea");
    document.body.append(textarea);
    stop = startChipController();

    textarea.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
    textarea.dispatchEvent(new FocusEvent("focusout", { bubbles: true }));
    await vi.advanceTimersByTimeAsync(130);
    expect(pillHost()!.style.display).toBe("none");
  });

  it("keeps a running action alive and shows its result after the editor loses focus", async () => {
    const textarea = document.createElement("textarea");
    textarea.value = LONG_DRAFT;
    document.body.append(textarea);
    let resolveAction: (result: RefineResult) => void = () => {};
    const performAction = vi
      .fn<(...args: unknown[]) => Promise<RefineResult>>()
      .mockReturnValue(new Promise((resolve) => (resolveAction = resolve)));
    stop = startChipController({ performAction });

    textarea.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
    pillButton().click();
    clickMenuItem("Refine prompt");

    textarea.dispatchEvent(new FocusEvent("focusout", { bubbles: true }));
    await vi.advanceTimersByTimeAsync(130);
    expect(pillHost()!.style.display).toBe("block");
    expect(pillButton().dataset.mode).toBe("loading");

    resolveAction({ decision: "refine", refinedText: REFINED_DRAFT });
    await vi.advanceTimersByTimeAsync(1);

    expect(pillButton().dataset.mode).toBe("result");
    expect(pillShadow().querySelector(".pz-pill__label")!.textContent).toBe(REFINED_DRAFT);
  });

  it("replaces the originating draft after focus moved away", async () => {
    const textarea = document.createElement("textarea");
    textarea.value = LONG_DRAFT;
    const other = document.createElement("input");
    document.body.append(textarea, other);
    const performAction = vi.fn<(...args: unknown[]) => Promise<RefineResult>>().mockResolvedValue({
      decision: "refine",
      refinedText: REFINED_DRAFT,
    });
    stop = startChipController({ performAction });

    textarea.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
    pillButton().click();
    clickMenuItem("Refine prompt");
    textarea.dispatchEvent(new FocusEvent("focusout", { bubbles: true }));
    await vi.advanceTimersByTimeAsync(130);

    const replaceButton = [...pillShadow().querySelectorAll("button")].find((b) => b.textContent === "Replace")!;
    replaceButton.click();

    expect(textarea.value).toBe(REFINED_DRAFT);
    expect(pillHost()!.style.display).toBe("none");
  });

  it("does not cancel a running action when another editor is focused", async () => {
    const textarea = document.createElement("textarea");
    textarea.value = LONG_DRAFT;
    const other = document.createElement("textarea");
    other.value = "another draft";
    document.body.append(textarea, other);
    const performAction = vi.fn<(...args: unknown[]) => Promise<RefineResult>>().mockResolvedValue({
      decision: "refine",
      refinedText: REFINED_DRAFT,
    });
    stop = startChipController({ performAction });

    textarea.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
    pillButton().click();
    clickMenuItem("Refine prompt");
    other.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
    await vi.advanceTimersByTimeAsync(1);

    expect(performAction).toHaveBeenCalledTimes(1);
    expect(pillButton().dataset.mode).toBe("result");

    const replaceButton = [...pillShadow().querySelectorAll("button")].find((b) => b.textContent === "Replace")!;
    replaceButton.click();
    expect(textarea.value).toBe(REFINED_DRAFT);
    expect(other.value).toBe("another draft");
    expect(pillButton().dataset.mode).toBe("dot");
  });

  it("drops a pending result when the originating editor is removed", async () => {
    const textarea = document.createElement("textarea");
    textarea.value = LONG_DRAFT;
    document.body.append(textarea);
    const performAction = vi.fn<(...args: unknown[]) => Promise<RefineResult>>().mockResolvedValue({
      decision: "refine",
      refinedText: REFINED_DRAFT,
    });
    stop = startChipController({ performAction });

    textarea.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
    pillButton().click();
    clickMenuItem("Refine prompt");
    await vi.advanceTimersByTimeAsync(1);

    textarea.remove();
    await vi.waitFor(() => expect(pillHost()!.style.display).toBe("none"));
  });

  it("hides the pill when the editor is removed from the page", async () => {
    const textarea = document.createElement("textarea");
    document.body.append(textarea);
    stop = startChipController();

    textarea.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
    expect(pillHost()!.style.display).toBe("block");

    textarea.remove();
    await vi.waitFor(() => expect(pillHost()!.style.display).toBe("none"));
  });

  it("resolves the outermost contenteditable ancestor when a nested node is focused", () => {
    const root = document.createElement("div");
    root.contentEditable = "true";
    const paragraph = document.createElement("p");
    root.append(paragraph);
    document.body.append(root);
    stop = startChipController();

    paragraph.dispatchEvent(new FocusEvent("focusin", { bubbles: true, composed: true }));

    expect(pillHost()!.style.display).toBe("block");
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
