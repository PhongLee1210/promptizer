import { performActionWithRealProviders } from "./action-router";
import { placeRail, placeWindow } from "./anchor";
import { PromptizerChip } from "./chip";
import {
  currentResult,
  initialChipState,
  reduceChipState,
  UNDO_WINDOW_MS,
  type ChipEvent,
  type ChipState,
  type ChipView,
} from "./chip-state";
import { getEditorText, isContentEditableElement, resolveEditableTarget } from "./editor-detector";
import { disableGlobally, isGloballyEnabled, onGlobalEnabledChanged } from "./global-enabled";
import { evictWarmSessions, prewarmNano } from "./nano";
import { presentResult } from "./present-result";
import { ActionRail } from "./rail";
import { ResultWindow } from "./result-window";
import type { ActionId, ActionSource, RefineResult } from "./action-types";
import { writeEditorText } from "./write-editor";

const FOCUS_OUT_GRACE_MS = 120;
const COPY_FLASH_MS = 1200;

export interface ChipControllerOptions {
  performAction?: (action: ActionId, text: string) => Promise<RefineResult>;
  prewarm?: () => void;
  releaseWarmSessions?: () => void;
}

interface AppliedDraft {
  editor: HTMLElement;
  originalText: string;
}

function railItemCount(hasHistory: boolean): number {
  return hasHistory ? 7 : 6;
}

export function startChipController(options: ChipControllerOptions = {}): () => void {
  const performAction = options.performAction ?? performActionWithRealProviders;
  const prewarm = options.prewarm ?? (() => void prewarmNano());
  const releaseWarmSessions = options.releaseWarmSessions ?? evictWarmSessions;

  let state: ChipState = initialChipState;
  let context: "chat" | "editor" = "chat";
  let globallyEnabled = true;
  let focusedEditor: HTMLElement | null = null;
  let pendingEditor: HTMLElement | null = null;
  let appliedDraft: AppliedDraft | null = null;
  let generation = 0;
  let resultIdCounter = 0;
  let blurHandle: number | undefined;
  let undoHandle: number | undefined;
  let copyHandle: number | undefined;

  const rail = new ActionRail({
    onSelectLeaf: (action) => runAction(action, "text"),
    onToggleGroup: (group) => dispatch({ type: "group-toggled", group }),
    onRecentOpened: () => dispatch({ type: "recent-opened" }),
    onTurnOff: () => turnOff(),
  });
  const resultWindow = new ResultWindow({
    onStep: (direction) => dispatch({ type: "step", direction }),
    onDeleteCurrent: () => dispatch({ type: "delete-current" }),
    onEditStart: () => dispatch({ type: "edit-started" }),
    onEditDiscard: () => dispatch({ type: "edit-discarded" }),
    onEditSave: (text) => dispatch({ type: "edit-saved", text }),
    onTweakToggle: () => dispatch({ type: "tweak-toggled" }),
    onRunTweak: (action) => runAction(action, "result"),
    onRegenerate: () => regenerate(),
    onCopy: () => copySuggestion(),
    onReplace: () => applySuggestion(),
    onRetry: () => retry(),
    onClose: () => closeWindow(),
  });
  const chip = new PromptizerChip(
    () => dispatch({ type: "chip-clicked" }),
    () => handleEscape(),
    () => undoReplace(),
  );
  chip.attachRail(rail.node());
  chip.attachWindow(resultWindow.node());
  chip.mount();

  const resizeObserver = new ResizeObserver(() => updatePosition());

  function anchorEditor(): HTMLElement | null {
    return pendingEditor ?? focusedEditor;
  }

  function dispatch(event: ChipEvent): void {
    const next = reduceChipState(state, event);
    if (next === state) {
      return;
    }
    const prevView = state.view;
    state = next;
    render();
    focusAfterTransition(prevView, event);
  }

  function focusAfterTransition(prevView: ChipView, event: ChipEvent): void {
    if (state.view.kind === "rail" && prevView.kind === "closed") {
      rail.focusFirstItem();
      return;
    }
    if (state.view.kind === "result" && event.type === "outcome-arrived") {
      resultWindow.focusPrimary();
      return;
    }
    if (state.view.kind === "error") {
      resultWindow.focusRetry();
    }
  }

  function render(): void {
    chip.setExpanded(state.view.kind !== "closed");
    chip.setLoading(state.view.kind === "loading");
    chip.setUndoVisible(state.replaced);
    rail.render(state.view, context, state.results.length > 0);
    resultWindow.render(state);
    updatePosition();
  }

  function updatePosition(): void {
    const anchor = anchorEditor();
    if (anchor !== null && document.contains(anchor)) {
      chip.positionInsideEditor(anchor);
    }
    const viewport = { width: window.innerWidth, height: window.innerHeight };
    if (state.view.kind === "rail") {
      chip.applyPanelPlacement(
        rail.node(),
        placeRail(chip.anchorRect(), railItemCount(state.results.length > 0), viewport),
      );
    } else if (state.view.kind !== "closed") {
      chip.applyPanelPlacement(resultWindow.node(), placeWindow(chip.anchorRect(), viewport));
    }
  }

  function handleEscape(): void {
    if (state.view.kind === "editing") {
      dispatch({ type: "edit-discarded" });
      return;
    }
    if (state.view.kind === "rail" && state.view.openGroup !== null) {
      dispatch({ type: "group-toggled", group: state.view.openGroup });
      return;
    }
    if (state.view.kind === "loading") {
      generation += 1;
      dispatch({ type: "run-cancelled" });
      chip.focusTrigger();
      return;
    }
    dispatch({ type: "dismissed" });
    chip.focusTrigger();
  }

  function closeWindow(): void {
    if (state.view.kind === "loading") {
      generation += 1;
      dispatch({ type: "run-cancelled" });
    } else {
      dispatch({ type: "dismissed" });
    }
    chip.focusTrigger();
  }

  function clearUndoWindow(): void {
    if (undoHandle !== undefined) {
      window.clearTimeout(undoHandle);
      undoHandle = undefined;
    }
    appliedDraft = null;
  }

  function clearPendingWork(): void {
    const editor = pendingEditor;
    pendingEditor = null;
    generation += 1;
    if (editor !== null) {
      stopObserving(editor);
    }
  }

  function stopObserving(editor: HTMLElement): void {
    if (editor !== focusedEditor && editor !== pendingEditor) {
      resizeObserver.unobserve(editor);
    }
  }

  function showChip(): void {
    if (!globallyEnabled || focusedEditor === null || !document.contains(focusedEditor)) {
      chip.hide();
      return;
    }
    chip.show();
    updatePosition();
  }

  function turnOff(): void {
    globallyEnabled = false;
    clearPendingWork();
    dispatch({ type: "dismissed" });
    chip.hide();
    void disableGlobally();
  }

  function setGloballyEnabled(enabled: boolean): void {
    if (globallyEnabled === enabled) {
      return;
    }
    globallyEnabled = enabled;
    if (!enabled) {
      clearPendingWork();
      dispatch({ type: "dismissed" });
      chip.hide();
    } else {
      showChip();
    }
  }

  function runAction(action: ActionId, source: ActionSource): void {
    const editor = anchorEditor();
    if (editor === null) {
      return;
    }
    const text = source === "text" ? getEditorText(editor).trim() : (currentResult(state)?.text ?? "");
    dispatch({ type: "action-selected", action, source, hasText: text.length > 0 });
    if (text.length === 0) {
      chip.show();
      updatePosition();
      return;
    }

    const myGeneration = ++generation;
    pendingEditor = editor;
    resizeObserver.observe(editor);
    chip.show();
    updatePosition();

    void performAction(action, text).then((result) => {
      if (myGeneration !== generation) {
        return;
      }
      if (!document.contains(editor)) {
        clearPendingWork();
        dispatch({ type: "editor-left" });
        showChip();
        return;
      }
      const outcome = presentResult({ action, result, originalText: text });
      dispatch({ type: "outcome-arrived", id: String(++resultIdCounter), action, source, outcome });
    });
  }

  function regenerate(): void {
    const entry = currentResult(state);
    if (entry === null) {
      return;
    }
    runAction(entry.action, "text");
  }

  function retry(): void {
    if (state.view.kind !== "error") {
      return;
    }
    runAction(state.view.action, state.view.source);
  }

  function applySuggestion(): void {
    const editor = pendingEditor;
    const entry = currentResult(state);
    if (editor === null || entry === null || !document.contains(editor)) {
      return;
    }
    clearUndoWindow();
    appliedDraft = { editor, originalText: getEditorText(editor) };
    writeEditorText(editor, entry.text);
    dispatch({ type: "replaced" });
    dispatch({ type: "dismissed" });
    chip.focusTrigger();
    undoHandle = window.setTimeout(() => {
      undoHandle = undefined;
      appliedDraft = null;
      dispatch({ type: "undo-expired" });
    }, UNDO_WINDOW_MS);
  }

  function undoReplace(): void {
    const draft = appliedDraft;
    if (draft === null || !document.contains(draft.editor)) {
      return;
    }
    writeEditorText(draft.editor, draft.originalText);
    clearUndoWindow();
    dispatch({ type: "undone" });
  }

  function copySuggestion(): void {
    const entry = currentResult(state);
    if (entry === null) {
      return;
    }
    void navigator.clipboard?.writeText(entry.text).catch(() => undefined);
    dispatch({ type: "copy-requested" });
    if (copyHandle !== undefined) {
      window.clearTimeout(copyHandle);
    }
    copyHandle = window.setTimeout(() => {
      copyHandle = undefined;
      dispatch({ type: "copy-reset" });
    }, COPY_FLASH_MS);
  }

  function activateEditor(target: HTMLElement): void {
    const previous = focusedEditor;
    focusedEditor = target;
    context = isContentEditableElement(target) ? "chat" : "editor";
    prewarm();
    resizeObserver.observe(target);
    if (previous !== null && previous !== target) {
      stopObserving(previous);
    }
    if (pendingEditor !== null) {
      return;
    }
    generation += 1;
    clearUndoWindow();
    dispatch({ type: "editor-left" });
    showChip();
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
    const editor = focusedEditor;
    if (editor === null || event.target !== editor) {
      return;
    }
    if (blurHandle !== undefined) {
      window.clearTimeout(blurHandle);
    }
    blurHandle = window.setTimeout(() => {
      blurHandle = undefined;
      if (document.activeElement === editor || state.view.kind !== "closed") {
        return;
      }
      focusedEditor = null;
      stopObserving(editor);
      if (pendingEditor === null) {
        chip.hide();
      } else {
        updatePosition();
      }
    }, FOCUS_OUT_GRACE_MS);
  }

  function handleDocumentClick(event: MouseEvent): void {
    if (state.view.kind === "closed" || state.view.kind === "loading") {
      return;
    }
    if (!chip.containsEventTarget(event)) {
      dispatch({ type: "dismissed" });
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
      dispatch({ type: "editor-left" });
      showChip();
    }
  });
  mutationObserver.observe(document.documentElement, { childList: true, subtree: true });

  document.addEventListener("focusin", handleFocusIn, true);
  document.addEventListener("focusout", handleFocusOut, true);
  document.addEventListener("click", handleDocumentClick, true);
  document.addEventListener("scroll", handleScrollOrResize, true);
  window.addEventListener("resize", handleScrollOrResize);

  render();

  const alreadyFocused = resolveEditableTarget(document.activeElement);
  if (alreadyFocused !== null) {
    activateEditor(alreadyFocused);
  }

  const unsubscribeGlobalEnabled = onGlobalEnabledChanged(setGloballyEnabled);
  void isGloballyEnabled().then(setGloballyEnabled);

  return function stopChipController(): void {
    if (blurHandle !== undefined) {
      window.clearTimeout(blurHandle);
    }
    if (copyHandle !== undefined) {
      window.clearTimeout(copyHandle);
    }
    clearUndoWindow();
    unsubscribeGlobalEnabled();
    document.removeEventListener("focusin", handleFocusIn, true);
    document.removeEventListener("focusout", handleFocusOut, true);
    document.removeEventListener("click", handleDocumentClick, true);
    document.removeEventListener("scroll", handleScrollOrResize, true);
    window.removeEventListener("resize", handleScrollOrResize);
    mutationObserver.disconnect();
    resizeObserver.disconnect();
    releaseWarmSessions();
    chip.destroy();
  };
}
