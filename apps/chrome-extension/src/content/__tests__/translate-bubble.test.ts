import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PANEL_GAP, placePanel } from "../anchor";
import type { Rect, Viewport } from "../anchor";
import { SLOW_HINT_TEXT, SLOW_OPERATION_HINT_MS } from "../loading-ui";
import { BUBBLE_HEIGHT, TranslateBubble, TranslateButton } from "../translate-bubble";

const realAttachShadow = Element.prototype.attachShadow;
const VIEWPORT: Viewport = { width: 1440, height: 900 };
const HOST_SELECTOR = "[data-promptizer-translate]";

function rectAt(top: number, left: number): Rect {
  return { top, left, right: left + 80, bottom: top + 20, width: 80, height: 20 };
}

function openShadowOf(host: HTMLElement): ShadowRoot {
  return host.shadowRoot as ShadowRoot;
}

function forceOpenShadowRoots(): void {
  vi.spyOn(Element.prototype, "attachShadow").mockImplementation(function (this: Element, init: ShadowRootInit) {
    return realAttachShadow.call(this, { ...init, mode: "open" });
  });
}

describe("TranslateBubble", () => {
  let bubble: TranslateBubble;
  let onCopy: ReturnType<typeof vi.fn>;
  let onClose: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    forceOpenShadowRoots();
    onCopy = vi.fn();
    onClose = vi.fn();
    bubble = new TranslateBubble({ onCopy, onClose });
    bubble.mount();
  });

  afterEach(() => {
    bubble.destroy();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  function hostText(): string {
    return openShadowOf(bubble.node()).textContent ?? "";
  }

  function control(label: string): HTMLButtonElement | null {
    return openShadowOf(bubble.node()).querySelector<HTMLButtonElement>(`[aria-label="${label}"]`);
  }

  it("renders the direction and the translated text when ready", () => {
    bubble.render({ kind: "ready", direction: { source: "en", target: "vi" }, text: "miễn cưỡng" });
    expect(hostText()).toContain("miễn cưỡng");
    expect(hostText()).toContain("English → Vietnamese");
  });

  it("shows a percentage while downloading", () => {
    bubble.render({ kind: "downloading", percent: 42 });
    expect(hostText()).toContain("Downloading language models");
    expect(hostText()).toContain("42%");
  });

  function liveRegion(): HTMLElement {
    return openShadowOf(bubble.node()).querySelector('[aria-live="polite"]') as HTMLElement;
  }

  it("uses shimmer lines and a busy label while detecting and translating", () => {
    for (const kind of ["detecting", "translating"] as const) {
      bubble.render({ kind });
      expect(liveRegion().querySelectorAll(".pz-load__line").length).toBeGreaterThan(0);
      expect(liveRegion().querySelector('.pz-load__dots[aria-hidden="true"]')).not.toBeNull();
    }
    expect(liveRegion().querySelector(".pz-load__label")?.textContent).toBe("Translating");
  });

  it("shows a determinate progress bar while downloading", () => {
    bubble.render({ kind: "downloading", percent: 42.4 });
    const bar = liveRegion().querySelector('[role="progressbar"]')!;
    expect(bar.getAttribute("aria-valuenow")).toBe("42");
    expect(bar.querySelector(".pz-load__progress-pct")?.textContent).toBe("42%");
  });

  it("shows an indeterminate progress bar at zero percent", () => {
    bubble.render({ kind: "downloading", percent: 0 });
    const bar = liveRegion().querySelector('[role="progressbar"]')!;
    expect(bar.hasAttribute("aria-valuenow")).toBe(false);
    expect(bar.querySelector<HTMLElement>(".pz-load__progress-fill")?.dataset.indeterminate).toBe("true");
  });

  describe("slow hint", () => {
    beforeEach(() => vi.useFakeTimers());

    function hint(): Element | null {
      return liveRegion().querySelector(".pz-load__hint");
    }

    it("appears after the threshold while busy", () => {
      bubble.render({ kind: "translating" });
      vi.advanceTimersByTime(SLOW_OPERATION_HINT_MS);
      expect(hint()?.textContent).toBe(SLOW_HINT_TEXT);
    });

    it("does not appear after the state settles or the bubble is destroyed", () => {
      bubble.render({ kind: "translating" });
      bubble.render({ kind: "error" });
      vi.advanceTimersByTime(SLOW_OPERATION_HINT_MS);
      expect(hint()).toBeNull();
      bubble.render({ kind: "detecting" });
      bubble.destroy();
      vi.advanceTimersByTime(SLOW_OPERATION_HINT_MS);
      expect(hint()).toBeNull();
    });
  });

  it("states that only English and Vietnamese are supported", () => {
    bubble.render({ kind: "unsupported-language" });
    expect(hostText()).toContain("English and Vietnamese");
  });

  it("states that translation is unavailable", () => {
    bubble.render({ kind: "unavailable" });
    expect(hostText().toLowerCase()).toContain("unavailable");
  });

  it("shows no copy button unless the state is ready", () => {
    bubble.render({ kind: "detecting" });
    expect(control("Copy translation")).toBeNull();
    bubble.render({ kind: "error" });
    expect(control("Copy translation")).toBeNull();
    bubble.render({ kind: "ready", direction: { source: "en", target: "vi" }, text: "x" });
    expect(control("Copy translation")).not.toBeNull();
  });

  it("invokes onCopy and onClose from their controls", () => {
    bubble.render({ kind: "ready", direction: { source: "en", target: "vi" }, text: "x" });
    control("Copy translation")?.click();
    control("Close translation")?.click();
    expect(onCopy).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("anchors by its top edge under a selection near the top of the viewport", () => {
    const rect = rectAt(104, 100);
    bubble.positionAt(rect, VIEWPORT);
    const expected = placePanel(rect, BUBBLE_HEIGHT, VIEWPORT);
    const host = bubble.node();
    expect(expected.placement).toBe("below");
    expect(host.style.top).toBe(`${rect.bottom + PANEL_GAP}px`);
    expect(host.style.bottom).toBe("auto");
    expect(host.style.right).toBe(`${expected.rightInset}px`);
    expect(host.style.maxWidth).toBe(`${expected.maxWidth}px`);
    expect(host.style.position).toBe("fixed");
  });

  it("anchors by its bottom edge above a selection near the bottom of the viewport", () => {
    const rect = rectAt(800, 100);
    bubble.positionAt(rect, VIEWPORT);
    const expected = placePanel(rect, BUBBLE_HEIGHT, VIEWPORT);
    const host = bubble.node();
    expect(expected.placement).toBe("above");
    expect(host.style.bottom).toBe(`${expected.bottomInset}px`);
    expect(host.style.top).toBe("auto");
  });

  it("removes its own host on destroy", () => {
    const secondBubble = new TranslateBubble({ onCopy, onClose });
    secondBubble.mount();
    const hostsBefore = document.querySelectorAll(HOST_SELECTOR).length;
    secondBubble.destroy();
    expect(secondBubble.node().isConnected).toBe(false);
    expect(document.querySelectorAll(HOST_SELECTOR).length).toBe(hostsBefore - 1);
  });
});

describe("TranslateButton", () => {
  let button: TranslateButton;
  let onClick: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    forceOpenShadowRoots();
    onClick = vi.fn();
    button = new TranslateButton(onClick);
  });

  afterEach(() => {
    button.destroy();
    vi.restoreAllMocks();
  });

  it("mounts the button at the selection rect and removes it on destroy", () => {
    button.mountAt(rectAt(300, 100));
    expect(document.querySelectorAll(HOST_SELECTOR)).toHaveLength(1);
    expect(button.node().style.position).toBe("fixed");
    expect(button.node().getAttribute("popover")).toBe("manual");
    expect(openShadowOf(button.node()).querySelector("svg")).not.toBeNull();
    const hostsBefore = document.querySelectorAll(HOST_SELECTOR).length;
    button.destroy();
    expect(button.node().isConnected).toBe(false);
    expect(document.querySelectorAll(HOST_SELECTOR)).toHaveLength(hostsBefore - 1);
  });

  it("calls its click handler once", () => {
    button.mountAt(rectAt(300, 100));
    openShadowOf(button.node()).querySelector<HTMLButtonElement>("button")?.click();
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
