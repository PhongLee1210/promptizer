import { performActionWithRealProviders } from "./action-router";
import { getEditorText, resolveEditableTarget } from "./editor-detector";
import { targetLanguageName } from "./language";
import { evictWarmSessions, prewarmNano } from "./nano";
import { FloatingPill, type ResultKind } from "./pill";
import type { ActionId, RefineResult } from "./action-types";
import { writeEditorText } from "./write-editor";

const FOCUS_OUT_GRACE_MS = 120;

export interface ChipControllerOptions {
  performAction?: (action: ActionId, text: string, targetLanguage?: string) => Promise<RefineResult>;
  prewarm?: () => void;
  releaseWarmSessions?: () => void;
}

export function startChipController(options: ChipControllerOptions = {}): () => void {
  const performAction = options.performAction ?? performActionWithRealProviders;
  const prewarm = options.prewarm ?? (() => void prewarmNano());
  const releaseWarmSessions = options.releaseWarmSessions ?? evictWarmSessions;
  const language = targetLanguageName();

  let focusedEditor: HTMLElement | null = null;
  let pendingEditor: HTMLElement | null = null;
  let refinedText: string | null = null;
  let generation = 0;
  let blurHandle: number | undefined;

  const pill = new FloatingPill(
    (action) => handleActionSelected(action),
    () => acceptSuggestion(),
    () => dismissResult(),
  );
  pill.buildMenu([
    { action: "refine", label: "Refine prompt", iconName: "sparkle" },
    { action: "translate", label: `Translate to ${language}`, iconName: "globe" },
    { action: "improve", label: "Improve", iconName: "check" },
  ]);
  pill.mount();

  const resizeObserver = new ResizeObserver(() => {
    updatePosition();
  });

  function anchorEditor(): HTMLElement | null {
    return pendingEditor ?? focusedEditor;
  }

  function updatePosition(): void {
    const anchor = anchorEditor();
    if (anchor === null || !document.contains(anchor)) {
      return;
    }
    pill.positionAtBottomRight(anchor.getBoundingClientRect());
  }

  function stopObserving(editor: HTMLElement): void {
    if (editor !== focusedEditor && editor !== pendingEditor) {
      resizeObserver.unobserve(editor);
    }
  }

  function clearPendingWork(): void {
    const editor = pendingEditor;
    pendingEditor = null;
    refinedText = null;
    generation += 1;
    if (editor !== null) {
      stopObserving(editor);
    }
  }

  function showIdleChip(): void {
    if (focusedEditor === null || !document.contains(focusedEditor)) {
      pill.hide();
      return;
    }
    pill.show();
    pill.setMode("dot");
    updatePosition();
  }

  function handleActionSelected(action: ActionId): void {
    const editor = anchorEditor();
    if (editor === null) {
      return;
    }
    const text = getEditorText(editor).trim();
    if (text.length === 0) {
      pill.setMode("dot");
      return;
    }
    const myGeneration = ++generation;
    pendingEditor = editor;
    refinedText = null;
    resizeObserver.observe(editor);
    pill.show();
    pill.setMode("loading");
    updatePosition();
    performAction(action, text, action === "translate" ? language : undefined).then((result) => {
      if (myGeneration !== generation) {
        return;
      }
      if (!document.contains(editor)) {
        clearPendingWork();
        showIdleChip();
        return;
      }
      presentResult(result);
    });
  }

  function presentResult(result: RefineResult): void {
    let kind: ResultKind;
    let label: string;
    if (result.decision === "refine" && result.refinedText !== undefined) {
      refinedText = result.refinedText;
      kind = "refine";
      label = result.refinedText;
    } else if (result.decision === "keep") {
      refinedText = null;
      kind = "keep";
      label = "Already clear";
    } else {
      refinedText = null;
      kind = "error";
      label = "Couldn't refine this draft";
    }
    pill.show();
    pill.setResult(kind, label);
    updatePosition();
  }

  function acceptSuggestion(): void {
    const editor = pendingEditor;
    if (editor === null || refinedText === null) {
      return;
    }
    const text = refinedText;
    const stillOnPage = document.contains(editor);
    clearPendingWork();
    if (stillOnPage) {
      writeEditorText(editor, text);
    }
    showIdleChip();
  }

  function dismissResult(): void {
    clearPendingWork();
    showIdleChip();
  }

  function activateEditor(target: HTMLElement): void {
    const previous = focusedEditor;
    focusedEditor = target;
    prewarm();
    resizeObserver.observe(target);
    if (previous !== null && previous !== target) {
      stopObserving(previous);
    }
    if (pendingEditor !== null) {
      return;
    }
    generation += 1;
    refinedText = null;
    showIdleChip();
  }

  function handleFocusIn(event: FocusEvent): void {
    const target = resolveEditableTarget(event.target);
    if (target === null) {
      return;
    }
    if (blurHandle !== undefined) {
      window.clearTimeout(blurHandle);
      blurHandle = undefined;
    }
    activateEditor(target);
  }

  function handleFocusOut(event: FocusEvent): void {
    if (event.target !== focusedEditor) {
      return;
    }
    const editor = focusedEditor;
    if (blurHandle !== undefined) {
      window.clearTimeout(blurHandle);
    }
    blurHandle = window.setTimeout(() => {
      blurHandle = undefined;
      if (document.activeElement === editor || pill.isMenuOpen()) {
        return;
      }
      focusedEditor = null;
      stopObserving(editor);
      if (pendingEditor === null) {
        pill.hide();
      } else {
        updatePosition();
      }
    }, FOCUS_OUT_GRACE_MS);
  }

  function handleDocumentClick(event: MouseEvent): void {
    if (pill.isMenuOpen() && !pill.isClickInside(event)) {
      pill.closeMenu();
    }
  }

  function handleScrollOrResize(): void {
    updatePosition();
  }

  const mutationObserver = new MutationObserver(() => {
    const pendingRemoved = pendingEditor !== null && !document.contains(pendingEditor);
    const focusedRemoved = focusedEditor !== null && !document.contains(focusedEditor);
    if (!pendingRemoved && !focusedRemoved) {
      return;
    }
    if (focusedRemoved) {
      const editor = focusedEditor as HTMLElement;
      focusedEditor = null;
      stopObserving(editor);
    }
    if (pendingRemoved) {
      clearPendingWork();
    }
    if (pendingEditor === null) {
      showIdleChip();
    }
  });
  mutationObserver.observe(document.documentElement, { childList: true, subtree: true });

  document.addEventListener("focusin", handleFocusIn, true);
  document.addEventListener("focusout", handleFocusOut, true);
  document.addEventListener("click", handleDocumentClick, true);
  document.addEventListener("scroll", handleScrollOrResize, true);
  window.addEventListener("resize", handleScrollOrResize);

  const alreadyFocused = resolveEditableTarget(document.activeElement);
  if (alreadyFocused !== null) {
    activateEditor(alreadyFocused);
  }

  return function stopChipController(): void {
    if (blurHandle !== undefined) {
      window.clearTimeout(blurHandle);
    }
    document.removeEventListener("focusin", handleFocusIn, true);
    document.removeEventListener("focusout", handleFocusOut, true);
    document.removeEventListener("click", handleDocumentClick, true);
    document.removeEventListener("scroll", handleScrollOrResize, true);
    window.removeEventListener("resize", handleScrollOrResize);
    mutationObserver.disconnect();
    resizeObserver.disconnect();
    releaseWarmSessions();
    pill.destroy();
  };
}
