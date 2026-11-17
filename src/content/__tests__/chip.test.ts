import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PromptizerChip } from "../chip";

const realAttachShadow = Element.prototype.attachShadow;

describe("PromptizerChip", () => {
  let chip: PromptizerChip;
  let onTriggerClick: ReturnType<typeof vi.fn>;
  let onEscape: ReturnType<typeof vi.fn>;
  let onUndoClick: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.spyOn(Element.prototype, "attachShadow").mockImplementation(function (this: Element, init: ShadowRootInit) {
      return realAttachShadow.call(this, { ...init, mode: "open" });
    });
    onTriggerClick = vi.fn();
    onEscape = vi.fn();
    onUndoClick = vi.fn();
    chip = new PromptizerChip(onTriggerClick, onEscape, onUndoClick);
    chip.mount();
  });

  afterEach(() => {
    chip.destroy();
    vi.restoreAllMocks();
  });

  function shadowRoot(): ShadowRoot {
    const host = document.querySelector("[data-promptizer-pill]") as HTMLElement;
    return host.shadowRoot as ShadowRoot;
  }

  it("mounts a single host element and shows/hides it", () => {
    expect(document.querySelectorAll("[data-promptizer-pill]")).toHaveLength(1);
    expect(chip.isVisible()).toBe(false);
    chip.show();
    expect(chip.isVisible()).toBe(true);
    chip.hide();
    expect(chip.isVisible()).toBe(false);
  });

  it("fires onTriggerClick when the main chip is clicked", () => {
    const trigger = shadowRoot().querySelector('[aria-label="Promptizer actions"]') as HTMLButtonElement;
    trigger.click();
    expect(onTriggerClick).toHaveBeenCalled();
  });

  it("fires onEscape on Escape anywhere in the root", () => {
    const trigger = shadowRoot().querySelector('[aria-label="Promptizer actions"]') as HTMLButtonElement;
    trigger.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(onEscape).toHaveBeenCalled();
  });

  it("hides the undo chip by default and shows it on request", () => {
    const undo = shadowRoot().querySelector('[aria-label="Undo replace"]') as HTMLButtonElement;
    expect(undo.hidden).toBe(true);
    chip.setUndoVisible(true);
    expect(undo.hidden).toBe(false);
    undo.click();
    expect(onUndoClick).toHaveBeenCalled();
    chip.setUndoVisible(false);
    expect(undo.hidden).toBe(true);
  });

  it("toggles the loading ring and expanded state on the trigger", () => {
    const trigger = shadowRoot().querySelector('[aria-label="Promptizer actions"]') as HTMLButtonElement;
    expect(trigger.dataset.loading).toBeUndefined();
    chip.setLoading(true);
    expect(trigger.dataset.loading).toBe("true");
    chip.setExpanded(true);
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
  });

  it("attaches rail and window nodes into the shadow root", () => {
    const rail = document.createElement("div");
    rail.dataset.testid = "rail";
    const win = document.createElement("div");
    win.dataset.testid = "win";
    chip.attachRail(rail);
    chip.attachWindow(win);
    expect(shadowRoot().querySelector('[data-testid="rail"]')).toBe(rail);
    expect(shadowRoot().querySelector('[data-testid="win"]')).toBe(win);
  });
});
