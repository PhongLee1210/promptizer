import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fakeBrowser } from "wxt/testing/fake-browser";
import { evictTranslators } from "../translator";
import type { TranslateOptions, TranslateOutcome } from "../translator";
import { TranslateBubble } from "../translate-bubble";
import { selectionCandidate, startSelectionTranslate } from "../selection-translate";

vi.mock("../translator", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../translator")>()),
  evictTranslators: vi.fn(),
}));

const realAttachShadow = Element.prototype.attachShadow;
const SELECTION_RECT = { top: 100, left: 40, right: 140, bottom: 120, width: 100, height: 20 };
const EMPTY_RECT = { top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0 };
const BUTTON_HOST = "[data-promptizer-translate]";
const MAX_LENGTH = 1500;

interface SelectionStub {
  text: string;
  rect?: typeof SELECTION_RECT;
  collapsed?: boolean;
  covers?: (node: Node) => boolean;
  anchor?: Node | null;
}

function selectionOf(stub: SelectionStub | string): Selection {
  const {
    text,
    rect = SELECTION_RECT,
    collapsed = false,
    covers = () => false,
    anchor = null,
  } = typeof stub === "string" ? ({ text: stub } as SelectionStub) : stub;
  const range = { getBoundingClientRect: () => rect, intersectsNode: covers };
  return {
    rangeCount: collapsed ? 0 : 1,
    isCollapsed: collapsed,
    anchorNode: anchor,
    toString: () => text,
    getRangeAt: () => range,
  } as unknown as Selection;
}

function textNodeIn(parent: HTMLElement): Text {
  const node = document.createTextNode("reluctant");
  parent.append(node);
  return node;
}

function openShadowRoots(): void {
  vi.spyOn(Element.prototype, "attachShadow").mockImplementation(function (this: Element, init: ShadowRootInit) {
    return realAttachShadow.call(this, { ...init, mode: "open" });
  });
}

function pageWithParagraph(): { paragraph: HTMLElement; text: Text } {
  const paragraph = document.createElement("p");
  document.body.append(paragraph);
  return { paragraph, text: textNodeIn(paragraph) };
}

function stubSelection(selection: Selection): void {
  vi.spyOn(window, "getSelection").mockReturnValue(selection);
}

function releaseMouseOn(target: Node): void {
  target.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
}

function hosts(): HTMLElement[] {
  return [...document.querySelectorAll<HTMLElement>(BUTTON_HOST)];
}

function buttonHost(): HTMLElement | undefined {
  return hosts().find((host) => host.shadowRoot?.querySelector(".pz-translate-button"));
}

function bubbleHost(): HTMLElement | undefined {
  return hosts().find((host) => host.shadowRoot?.querySelector(".pz-translate-bubble"));
}

function clickTranslateButton(): void {
  buttonHost()!.shadowRoot!.querySelector<HTMLButtonElement>(".pz-translate-button")!.click();
}

function bubbleText(): string {
  return bubbleHost()?.shadowRoot?.textContent ?? "";
}

function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void } {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => (resolve = done));
  return { promise, resolve };
}

function translated(text: string): TranslateOutcome {
  return { kind: "translated", direction: { source: "en", target: "vi" }, text };
}

describe("selectionCandidate", () => {
  let paragraph: HTMLElement;
  let text: Text;

  beforeEach(() => {
    ({ paragraph, text } = pageWithParagraph());
  });

  afterEach(() => {
    document.body.replaceChildren();
  });

  it("accepts a plain text selection and returns its text and rect", () => {
    const candidate = selectionCandidate(selectionOf("  reluctant "), text);

    expect(candidate).toEqual({ text: "reluctant", rect: SELECTION_RECT });
  });

  it("rejects an empty, collapsed or whitespace-only selection", () => {
    expect(selectionCandidate(null, text)).toBeNull();
    expect(selectionCandidate(selectionOf(""), text)).toBeNull();
    expect(selectionCandidate(selectionOf("   \n "), text)).toBeNull();
    expect(selectionCandidate(selectionOf({ text: "reluctant", collapsed: true }), text)).toBeNull();
  });

  it("rejects a selection whose bounding rect has no size", () => {
    expect(selectionCandidate(selectionOf({ text: "reluctant", rect: EMPTY_RECT }), text)).toBeNull();
  });

  it("accepts exactly 1500 characters and rejects 1501", () => {
    expect(selectionCandidate(selectionOf("a".repeat(MAX_LENGTH)), text)).not.toBeNull();
    expect(selectionCandidate(selectionOf("a".repeat(MAX_LENGTH + 1)), text)).toBeNull();
  });

  it("rejects a selection inside a textarea or a contenteditable", () => {
    const textarea = document.createElement("textarea");
    const editable = document.createElement("div");
    editable.contentEditable = "true";
    Object.defineProperty(editable, "isContentEditable", { value: true });
    document.body.append(textarea, editable);

    expect(selectionCandidate(selectionOf("reluctant"), textarea)).toBeNull();
    expect(selectionCandidate(selectionOf({ text: "reluctant", anchor: textNodeIn(editable) }), editable)).toBeNull();
  });

  it("rejects a mouseup on a link the selection does not cover", () => {
    const link = document.createElement("a");
    paragraph.append(link);

    expect(selectionCandidate(selectionOf("reluctant"), link)).toBeNull();
  });

  it("accepts a sentence selection that contains a link", () => {
    const link = document.createElement("a");
    paragraph.append(link);

    expect(
      selectionCandidate(selectionOf({ text: "reluctant", covers: (node) => node === link }), link),
    ).not.toBeNull();
  });

  it.each(["data-promptizer-pill", "data-promptizer-translate"])("rejects a mouseup inside a %s host", (attribute) => {
    const host = document.createElement("div");
    host.setAttribute(attribute, "");
    const inner = document.createElement("span");
    host.append(inner);
    document.body.append(host);

    expect(selectionCandidate(selectionOf("refined text"), host)).toBeNull();
    expect(selectionCandidate(selectionOf("refined text"), inner)).toBeNull();
  });
});

describe("startSelectionTranslate", () => {
  let stop: (() => void) | undefined;
  let text: Text;
  let translate: ReturnType<typeof vi.fn>;

  async function start(globallyEnabled: () => Promise<boolean> = async () => true): Promise<void> {
    stop = startSelectionTranslate({ translate, globallyEnabled });
    await Promise.resolve();
  }

  function select(content: string): void {
    stubSelection(selectionOf(content));
    releaseMouseOn(text);
  }

  beforeEach(() => {
    openShadowRoots();
    ({ text } = pageWithParagraph());
    translate = vi.fn().mockResolvedValue(translated("lưỡng lự"));
    vi.mocked(evictTranslators).mockClear();
  });

  afterEach(() => {
    stop?.();
    stop = undefined;
    document.body.replaceChildren();
    vi.restoreAllMocks();
    fakeBrowser.reset();
  });

  it("shows the button on a valid mouseup and translates on click", async () => {
    await start();
    select("reluctant");

    expect(buttonHost()).toBeDefined();
    clickTranslateButton();
    await vi.waitFor(() => expect(bubbleText()).toContain("lưỡng lự"));
    expect(translate).toHaveBeenCalledWith("reluctant", expect.objectContaining({ onProgress: expect.any(Function) }));
    expect(buttonHost()).toBeUndefined();
  });

  it("walks through detecting, downloading, translating and the result", async () => {
    const pending = deferred<TranslateOutcome>();
    let options!: TranslateOptions;
    translate.mockImplementation((_text, received: TranslateOptions) => {
      options = received;
      return pending.promise;
    });
    await start();
    select("reluctant");
    clickTranslateButton();
    expect(bubbleText()).toContain("Detecting language");

    options.onProgress?.(40);
    expect(bubbleText()).toContain("Downloading language models");
    expect(bubbleText()).toContain("40%");
    options.onPhase?.("translating");
    expect(bubbleText()).toContain("Translating");
    expect(bubbleText()).not.toContain("Downloading");
    options.onPhase?.("detecting");
    expect(bubbleText()).toContain("Detecting language");

    pending.resolve(translated("lưỡng lự"));
    await vi.waitFor(() => expect(bubbleText()).toContain("lưỡng lự"));
  });

  it("shows no button when Promptizer is globally disabled", async () => {
    await start(async () => false);
    select("reluctant");

    expect(buttonHost()).toBeUndefined();
  });

  it("translates the text captured at button creation, not at click time", async () => {
    await start();
    select("reluctant");
    stubSelection(selectionOf({ text: "", collapsed: true }));

    clickTranslateButton();

    await vi.waitFor(() => expect(translate).toHaveBeenCalledWith("reluctant", expect.anything()));
  });

  it("ignores a stale translation when a newer selection superseded it", async () => {
    const first = deferred<TranslateOutcome>();
    const second = deferred<TranslateOutcome>();
    translate.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    await start();

    select("first");
    clickTranslateButton();
    select("second");
    clickTranslateButton();
    second.resolve(translated("second result"));
    await vi.waitFor(() => expect(bubbleText()).toContain("second result"));
    first.resolve(translated("first result"));
    await first.promise;
    await Promise.resolve();

    expect(bubbleText()).toContain("second result");
    expect(bubbleText()).not.toContain("first result");
  });

  it("drops the result without rendering when the host is removed while a translation is in flight", async () => {
    const pending = deferred<TranslateOutcome>();
    translate.mockReturnValue(pending.promise);
    await start();
    select("reluctant");
    clickTranslateButton();
    const render = vi.spyOn(TranslateBubble.prototype, "render");

    bubbleHost()!.remove();
    pending.resolve(translated("lưỡng lự"));
    await pending.promise;
    await new Promise((done) => setTimeout(done, 0));

    expect(render).not.toHaveBeenCalled();
    expect(bubbleHost()).toBeUndefined();
  });

  it("removes the button when the selection collapses", async () => {
    await start();
    select("reluctant");

    stubSelection(selectionOf({ text: "", collapsed: true }));
    document.dispatchEvent(new Event("selectionchange"));

    expect(buttonHost()).toBeUndefined();
  });

  it("keeps the button on a mousedown inside it", async () => {
    await start();
    select("reluctant");

    buttonHost()!.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, composed: true }));

    expect(buttonHost()).toBeDefined();
  });

  it("closes the bubble on Escape", async () => {
    await start();
    select("reluctant");
    clickTranslateButton();
    await vi.waitFor(() => expect(bubbleText()).toContain("lưỡng lự"));

    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));

    expect(bubbleHost()).toBeUndefined();
  });

  it("closes the bubble on an outside click but not on a click inside it", async () => {
    await start();
    select("reluctant");
    clickTranslateButton();
    await vi.waitFor(() => expect(bubbleText()).toContain("lưỡng lự"));

    bubbleHost()!.dispatchEvent(new MouseEvent("click", { bubbles: true, composed: true }));
    expect(bubbleHost()).toBeDefined();

    document.body.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(bubbleHost()).toBeUndefined();
  });

  it("copies the translation to the clipboard and tolerates a rejected write", async () => {
    const writeText = vi.fn().mockRejectedValue(new Error("denied"));
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    await start();
    select("reluctant");
    clickTranslateButton();
    await vi.waitFor(() => expect(bubbleText()).toContain("lưỡng lự"));

    bubbleHost()!.shadowRoot!.querySelector<HTMLButtonElement>('[aria-label="Copy translation"]')!.click();
    await Promise.resolve();

    expect(writeText).toHaveBeenCalledTimes(1);
    expect(writeText).toHaveBeenCalledWith("lưỡng lự");
    vi.unstubAllGlobals();
  });

  it("evicts translators, removes hosts and listeners when the stop function runs", async () => {
    await start();
    select("reluctant");
    clickTranslateButton();
    select("again");

    stop!();
    stop = undefined;

    expect(evictTranslators).toHaveBeenCalledTimes(1);
    expect(hosts()).toHaveLength(0);
    select("after stop");
    expect(hosts()).toHaveLength(0);
    await fakeBrowser.storage.local.set({ popupState: { globalEnabled: true } });
    expect(hosts()).toHaveLength(0);
  });
});
