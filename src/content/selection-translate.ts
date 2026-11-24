import type { Rect } from "./anchor";
import { resolveEditableTarget } from "./editor-detector";
import { isGloballyEnabled, onGlobalEnabledChanged } from "./global-enabled";
import { TranslateBubble, TranslateButton } from "./translate-bubble";
import type { BubbleState } from "./translate-bubble";
import { evictTranslators, MAX_SELECTION_LENGTH, translateSelection } from "./translator";
import type { TranslateOptions, TranslateOutcome } from "./translator";

export interface SelectionCandidate {
  readonly text: string;
  readonly rect: Rect;
}

export interface SelectionTranslateOptions {
  translate?: (text: string, options: TranslateOptions) => Promise<TranslateOutcome>;
  globallyEnabled?: () => Promise<boolean>;
}

const OWN_UI_SELECTOR = "[data-promptizer-pill], [data-promptizer-translate]";
const INTERACTIVE_SELECTOR = [
  "a",
  "button",
  "input",
  "textarea",
  "select",
  '[role="button"]',
  '[role="link"]',
  '[role="menuitem"]',
  '[role="tab"]',
  '[role="checkbox"]',
  '[role="radio"]',
  '[role="switch"]',
  '[role="option"]',
].join(", ");

function elementOf(node: EventTarget | null): Element | null {
  if (node instanceof Element) {
    return node;
  }
  return node instanceof Node ? node.parentElement : null;
}

function toRect(source: DOMRect): Rect {
  return {
    top: source.top,
    right: source.right,
    bottom: source.bottom,
    left: source.left,
    width: source.width,
    height: source.height,
  };
}

function isInsideEditable(target: Element | null, anchorElement: Element | null): boolean {
  return [target, anchorElement].some(
    (element) => element instanceof HTMLElement && resolveEditableTarget(element) !== null,
  );
}

function isOnUncoveredInteractive(target: Element | null, range: Range): boolean {
  const interactive = target?.closest(INTERACTIVE_SELECTOR) ?? null;
  return interactive !== null && !range.intersectsNode(interactive);
}

export function selectionCandidate(selection: Selection | null, target: EventTarget | null): SelectionCandidate | null {
  if (selection === null || selection.isCollapsed || selection.rangeCount === 0) {
    return null;
  }
  const text = selection.toString().trim();
  if (text.length === 0 || text.length > MAX_SELECTION_LENGTH) {
    return null;
  }
  const range = selection.getRangeAt(0);
  const rect = toRect(range.getBoundingClientRect());
  if (rect.width === 0 || rect.height === 0) {
    return null;
  }
  const targetElement = elementOf(target);
  if (isInsideEditable(targetElement, elementOf(selection.anchorNode))) {
    return null;
  }
  if (targetElement?.closest(OWN_UI_SELECTOR) != null) {
    return null;
  }
  if (isOnUncoveredInteractive(targetElement, range)) {
    return null;
  }
  return { text, rect };
}

function bubbleStateFor(outcome: TranslateOutcome): BubbleState {
  return outcome.kind === "translated"
    ? { kind: "ready", direction: outcome.direction, text: outcome.text }
    : { kind: outcome.kind };
}

export function startSelectionTranslate(options: SelectionTranslateOptions = {}): () => void {
  const translate = options.translate ?? translateSelection;
  const globallyEnabled = options.globallyEnabled ?? isGloballyEnabled;

  let enabled = false;
  let hasReceivedChange = false;
  let generation = 0;
  let button: TranslateButton | null = null;
  let buttonSelectionText = "";
  let bubble: TranslateBubble | null = null;
  let translatedText = "";

  function destroyButton(): void {
    button?.destroy();
    button = null;
    buttonSelectionText = "";
  }

  function closeBubble(): void {
    generation += 1;
    bubble?.destroy();
    bubble = null;
    translatedText = "";
  }

  function copyTranslation(): void {
    void navigator.clipboard?.writeText(translatedText).catch(() => undefined);
  }

  function openBubble(candidate: SelectionCandidate): TranslateBubble {
    bubble?.destroy();
    const opened = new TranslateBubble({ onCopy: copyTranslation, onClose: closeBubble });
    opened.mount();
    opened.positionAt(candidate.rect, { width: window.innerWidth, height: window.innerHeight });
    bubble = opened;
    return opened;
  }

  function translateCandidate(candidate: SelectionCandidate): void {
    destroyButton();
    const myGeneration = ++generation;
    const opened = openBubble(candidate);
    translatedText = "";
    let hasOutcome = false;
    const isCurrent = () => myGeneration === generation && !hasOutcome;

    void translate(candidate.text, {
      onProgress: (percent) => {
        if (isCurrent()) {
          opened.render({ kind: "downloading", percent });
        }
      },
      onPhase: (phase) => {
        if (isCurrent()) {
          opened.render({ kind: phase });
        }
      },
    }).then((outcome) => {
      if (myGeneration !== generation) {
        return;
      }
      hasOutcome = true;
      if (!document.documentElement.contains(opened.node())) {
        closeBubble();
        return;
      }
      translatedText = outcome.kind === "translated" ? outcome.text : "";
      opened.render(bubbleStateFor(outcome));
    });
  }

  function showButtonFor(candidate: SelectionCandidate): void {
    destroyButton();
    closeBubble();
    const created = new TranslateButton(() => translateCandidate(candidate));
    created.mountAt(candidate.rect);
    button = created;
    buttonSelectionText = candidate.text;
  }

  function handleMouseUp(event: MouseEvent): void {
    if (!enabled) {
      return;
    }
    const candidate = selectionCandidate(window.getSelection(), event.target);
    if (candidate !== null) {
      showButtonFor(candidate);
    }
  }

  function handleMouseDown(event: MouseEvent): void {
    if (button !== null && !button.containsEventTarget(event)) {
      destroyButton();
    }
  }

  function handleSelectionChange(): void {
    if (button === null) {
      return;
    }
    const selection = window.getSelection();
    const selectedText = selection === null || selection.isCollapsed ? "" : selection.toString().trim();
    if (selectedText !== buttonSelectionText) {
      destroyButton();
    }
  }

  function handleClick(event: MouseEvent): void {
    if (bubble !== null && !bubble.containsEventTarget(event)) {
      closeBubble();
    }
  }

  function handleKeyDown(event: KeyboardEvent): void {
    if (event.key === "Escape" && bubble !== null) {
      closeBubble();
    }
  }

  function setEnabled(next: boolean): void {
    enabled = next;
    if (!next) {
      destroyButton();
      closeBubble();
    }
  }

  document.addEventListener("mouseup", handleMouseUp, true);
  document.addEventListener("mousedown", handleMouseDown, true);
  document.addEventListener("click", handleClick, true);
  document.addEventListener("selectionchange", handleSelectionChange);
  document.addEventListener("keydown", handleKeyDown, true);

  const unsubscribeGlobalEnabled = onGlobalEnabledChanged((next) => {
    hasReceivedChange = true;
    setEnabled(next);
  });
  void globallyEnabled().then((initial) => {
    if (!hasReceivedChange) {
      setEnabled(initial);
    }
  });

  return function stopSelectionTranslate(): void {
    document.removeEventListener("mouseup", handleMouseUp, true);
    document.removeEventListener("mousedown", handleMouseDown, true);
    document.removeEventListener("click", handleClick, true);
    document.removeEventListener("selectionchange", handleSelectionChange);
    document.removeEventListener("keydown", handleKeyDown, true);
    unsubscribeGlobalEnabled();
    destroyButton();
    closeBubble();
    evictTranslators();
  };
}
