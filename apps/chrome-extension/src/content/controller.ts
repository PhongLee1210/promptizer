import { API_ORIGIN } from "../account/api-origin";
import { hasStoredSession, onStoredSessionChanged } from "../account/session-store";
import { createLibraryCache } from "../library/library-cache.ts";
import { createBrowserSnapshotStore } from "../library/snapshot-store.ts";
import { performActionWithRealProviders } from "./action-router";
import { placePicker, placeRail, placeWindow } from "./anchor";
import { PromptizerChip } from "./chip";
import {
  currentResult,
  initialChipState,
  LIBRARY_ORIGIN,
  reduceChipState,
  UNDO_WINDOW_MS,
  type ChipEvent,
  type ChipState,
  type ChipView,
} from "./chip-state";
import { getEditorText, isContentEditableElement, resolveEditableTarget } from "./editor-detector";
import { disableGlobally, isGloballyEnabled, onGlobalEnabledChanged } from "./global-enabled";
import { evictWarmSessions, prepareNano, prewarmNano, type NanoAvailability } from "./nano";
import { presentResult } from "./present-result";
import { PromptPicker } from "./prompt-picker";
import { ActionRail } from "./rail";
import { ResultWindow } from "./result-window";
import type { SaveOutcome } from "./result-window";
import { requestSavePrompt } from "./save-prompt-request.ts";
import type { ActionId, ActionSource, RefineResult } from "./action-types";
import { writeEditorText } from "./write-editor";
import type { Prompt } from "@promptizer/shared";

const FOCUS_OUT_GRACE_MS = 120;
const COPY_FLASH_MS = 1200;
const RAIL_BASE_ITEM_COUNT = 6;
const MY_PROMPTS_URL = `${API_ORIGIN}/prompts`;

export interface ChipControllerOptions {
  performAction?: (action: ActionId, text: string) => Promise<RefineResult>;
  prepareModel?: (onProgress: (percent: number) => void) => Promise<NanoAvailability>;
  prewarm?: () => void;
  releaseWarmSessions?: () => void;
}

interface AppliedDraft {
  editor: HTMLElement;
  originalText: string;
}

function railItemCount(hasHistory: boolean, signedIn: boolean): number {
  return RAIL_BASE_ITEM_COUNT + Number(hasHistory) + Number(signedIn) * 2;
}

export function startChipController(options: ChipControllerOptions = {}): () => void {
  const performAction = options.performAction ?? performActionWithRealProviders;
  const prepareModel = options.prepareModel ?? ((onProgress) => prepareNano({ onProgress }));
  const prewarm = options.prewarm ?? (() => void prewarmNano());
  const releaseWarmSessions = options.releaseWarmSessions ?? evictWarmSessions;

  let state: ChipState = initialChipState;
  let context: "chat" | "editor" = "chat";
  let globallyEnabled = true;
  let signedIn = false;
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
    onSavePromptOpened: () => openSavePrompt(),
    onMyPromptsOpened: () => openPicker(),
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
    onSaveCancel: () => closeWindow(),
    onSaveConfirm: (title) => confirmSavePrompt(title),
  });
  const picker = new PromptPicker({
    onPick: (prompt) => insertPrompt(prompt.title, prompt.text),
    onOpenDashboard: () => openDashboard(),
    onClose: () => closeWindow(),
  });
  const chip = new PromptizerChip(
    () => dispatch({ type: "chip-clicked" }),
    () => handleEscape(),
    () => undoReplace(),
  );
  chip.attachRail(rail.node());
  chip.attachWindow(resultWindow.node());
  chip.attachWindow(picker.node());
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
    if (state.view.kind === "picker") {
      picker.focusSearch();
      return;
    }
    if (state.view.kind === "saving") {
      resultWindow.focusTitle();
      return;
    }
    if (state.view.kind === "result" && (event.type === "outcome-arrived" || event.type === "prompt-picked")) {
      resultWindow.focusPrimary();
      return;
    }
    if (state.view.kind === "error") {
      resultWindow.focusRetry();
    }
  }

  function render(): void {
    chip.setExpanded(state.view.kind !== "closed");
    chip.setLoading(state.view.kind === "loading" || state.view.kind === "preparing");
    chip.setProgress(state.view.kind === "preparing" ? state.view.percent : null);
    chip.setUndoVisible(state.replaced);
    rail.render(state.view, context, state.results.length > 0, signedIn);
    resultWindow.render(state);
    picker.render(state.view.kind === "picker");
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
        placeRail(chip.anchorRect(), railItemCount(state.results.length > 0, signedIn), viewport),
      );
    } else if (state.view.kind === "picker") {
      chip.applyPanelPlacement(picker.node(), placePicker(chip.anchorRect(), viewport));
    } else if (state.view.kind !== "closed") {
      chip.applyPanelPlacement(resultWindow.node(), placeWindow(chip.anchorRect(), viewport));
    }
  }

  function handleEscape(): void {
    if (state.view.kind === "editing") {
      dispatch({ type: "edit-discarded" });
      return;
    }
    if (state.view.kind === "picker" && picker.handleEscape()) {
      return;
    }
    if (state.view.kind === "rail" && state.view.openGroup !== null) {
      dispatch({ type: "group-toggled", group: state.view.openGroup });
      return;
    }
    if (state.view.kind === "loading" || state.view.kind === "preparing") {
      generation += 1;
      dispatch({ type: "run-cancelled" });
      chip.focusTrigger();
      return;
    }
    dispatch({ type: "dismissed" });
    chip.focusTrigger();
  }

  function closeWindow(): void {
    if (state.view.kind === "loading" || state.view.kind === "preparing") {
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

  function openDashboard(): void {
    window.open(MY_PROMPTS_URL, "_blank", "noopener");
    dispatch({ type: "dismissed" });
    chip.focusTrigger();
  }

  function openPicker(): void {
    generation += 1;
    dispatch({ type: "picker-opened" });
  }

  function openSavePrompt(): void {
    const editor = anchorEditor();
    if (editor === null) {
      return;
    }
    const draft = getEditorText(editor).trim();
    generation += 1;
    dispatch({ type: "save-opened", draft });
  }

  async function confirmSavePrompt(title: string): Promise<SaveOutcome> {
    if (state.view.kind !== "saving") {
      return { ok: false, message: "Something went wrong. Please try again." };
    }
    const result = await requestSavePrompt({ title, text: state.view.draft });
    if (!result.ok) {
      return { ok: false, message: result.message };
    }
    await cacheSavedPrompt(result.prompt);
    return { ok: true };
  }

  async function cacheSavedPrompt(prompt: Prompt): Promise<void> {
    const cache = createLibraryCache(createBrowserSnapshotStore());
    const current = await cache.read();
    await cache.save({
      prompts: [prompt, ...current.prompts],
      packs: current.packs,
      fetchedAt: current.fetchedAt ?? Math.floor(Date.now() / 1000),
    });
  }

  function setSignedIn(nextSignedIn: boolean): void {
    if (signedIn === nextSignedIn) {
      return;
    }
    signedIn = nextSignedIn;
    if (!signedIn && state.view.kind === "picker") {
      dispatch({ type: "dismissed" });
      return;
    }
    render();
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

    void runUntilAnswered(action, text, myGeneration).then((result) => {
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

  // A missing on-device model is recoverable: download it, reporting progress on the chip, then
  // answer the request that exposed the gap.
  async function runUntilAnswered(action: ActionId, text: string, myGeneration: number): Promise<RefineResult> {
    const first = await performAction(action, text);
    if (first.reason !== "not-configured" || myGeneration !== generation) {
      return first;
    }
    const readiness = await prepareModel((percent) => {
      if (myGeneration === generation) {
        dispatch({ type: "prepare-progress", percent });
      }
    });
    if (readiness !== "available" || myGeneration !== generation) {
      return first;
    }
    return performAction(action, text);
  }

  function insertPrompt(title: string, text: string): void {
    const editor = anchorEditor();
    if (editor === null || !document.contains(editor)) {
      closeWindow();
      return;
    }
    generation += 1;
    pendingEditor = editor;
    resizeObserver.observe(editor);
    dispatch({ type: "prompt-picked", id: String(++resultIdCounter), title, text });
  }

  function regenerate(): void {
    const entry = currentResult(state);
    if (entry === null || entry.action === LIBRARY_ORIGIN) {
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
    if (state.view.kind === "closed" || state.view.kind === "loading" || state.view.kind === "preparing") {
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
  const unsubscribeStoredSession = onStoredSessionChanged(setSignedIn);
  void hasStoredSession().then(setSignedIn);

  return function stopChipController(): void {
    if (blurHandle !== undefined) {
      window.clearTimeout(blurHandle);
    }
    if (copyHandle !== undefined) {
      window.clearTimeout(copyHandle);
    }
    clearUndoWindow();
    unsubscribeGlobalEnabled();
    unsubscribeStoredSession();
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
