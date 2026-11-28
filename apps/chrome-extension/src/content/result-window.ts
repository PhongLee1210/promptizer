import { icon, type IconName } from "../utils/icons";
import type { ActionId } from "./action-types";
import { currentResult, LIBRARY_ORIGIN, type ChipState } from "./chip-state";
import {
  LOADING_STYLE,
  SlowHintTimer,
  applySettleIn,
  createBusyLabel,
  createProgressBar,
  createShimmerLines,
  createSlowHint,
  updateProgressBar,
} from "./loading-ui";
import {
  ACTION_COPY,
  OFFLINE_SAVE_MESSAGE,
  PREPARING_CAPTION,
  PREPARING_TITLE,
  UNREACHABLE_WRITE_MESSAGE,
} from "./present-result";
import type { WriteFailureNotice, WriteFailureRecovery } from "./present-result";

export type SaveOutcome = { ok: true; showFirstSaveNotice: boolean } | ({ ok: false } & WriteFailureNotice);

export interface ResultWindowCallbacks {
  onStep: (direction: -1 | 1) => void;
  onDeleteCurrent: () => void;
  onEditStart: () => void;
  onEditDiscard: () => void;
  onEditSave: (text: string) => void;
  onTweakToggle: () => void;
  onRunTweak: (action: ActionId) => void;
  onRegenerate: () => void;
  onCopy: () => void;
  onReplace: () => void;
  onRetry: () => void;
  onClose: () => void;
  onSaveCancel: () => void;
  onSaveConfirm: (title: string) => Promise<SaveOutcome>;
}

const SKELETON_LINE_WIDTHS = ["92%", "78%", "54%"] as const;
const SAVE_CONFIRM_FLASH_MS = 900;
const TITLE_PREFILL_MAX_LENGTH = 80;

function prefillTitle(draft: string): string {
  const firstLine = draft.split("\n")[0]?.trim() ?? "";
  if (firstLine.length === 0) {
    return "";
  }
  return firstLine.length > TITLE_PREFILL_MAX_LENGTH
    ? `${firstLine.slice(0, TITLE_PREFILL_MAX_LENGTH).trimEnd()}…`
    : firstLine;
}
const PREPARING_MODEL_NAME = "Gemini Nano";

const TWEAK_LEAVES: ActionId[] = ["shorten", "grammar", "pro", "friendly", "direct", "vi", "en"];

export const WINDOW_STYLE = `
  .pz-win {
    position: fixed;
    display: none;
    flex-direction: column;
    width: 280px;
    border-radius: 12px;
    background: var(--pz-color-background-base-floating);
    border: 1px solid var(--pz-color-border-base-floating);
    box-shadow: var(--pz-elevation-base-medium);
    color: var(--pz-color-text-base-default);
    overflow: hidden;
  }
  .pz-win[data-open="true"] {
    display: flex;
    animation: pz-win-pop var(--pz-dur-base) var(--pz-ease-out);
  }
  @keyframes pz-win-pop {
    from {
      opacity: 0;
      transform: translateY(6px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .pz-win[data-open="true"] {
      animation: none;
    }
  }
  .pz-win__bar {
    flex: none;
    height: 34px;
    padding: 0 4px;
    display: flex;
    align-items: center;
    gap: 2px;
  }
  .pz-win__bar--top {
    display: grid;
    grid-template-columns: auto 1fr auto;
    border-bottom: 1px solid var(--pz-color-border-base-muted);
  }
  .pz-win__bar--bottom {
    border-top: 1px solid var(--pz-color-border-base-muted);
  }
  .pz-win__leading,
  .pz-win__trailing {
    display: flex;
    align-items: center;
    gap: 2px;
  }
  .pz-win__trailing {
    justify-content: flex-end;
  }
  .pz-win__counter {
    min-width: 28px;
    text-align: center;
    font-size: 11px;
    font-variant-numeric: tabular-nums;
    color: var(--pz-color-text-base-subdued);
  }
  .pz-win__title {
    margin: 0 4px;
    font-size: 12px;
    font-weight: 600;
    text-align: center;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .pz-win__edited {
    font-size: 10px;
    font-weight: 500;
    color: var(--pz-color-text-base-subdued);
  }
  .pz-win__bodywrap {
    height: 80px;
  }
  .pz-win__body {
    display: block;
    box-sizing: border-box;
    width: 100%;
    height: 100%;
    margin: 0;
    padding: 10px 12px;
    border: 0;
    overflow-y: auto;
    resize: none;
    outline: 0;
    background: transparent;
    color: inherit;
    font: inherit;
    font-size: 13px;
    line-height: 1.5;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }
  textarea.pz-win__body {
    background: var(--pz-color-background-base-raised);
  }
  .pz-win__body {
    scrollbar-width: thin;
    scrollbar-color: var(--pz-color-fill-track-default) transparent;
  }
  .pz-win__body::-webkit-scrollbar {
    width: 8px;
  }
  .pz-win__body::-webkit-scrollbar-track {
    background: transparent;
  }
  .pz-win__body::-webkit-scrollbar-thumb {
    background: var(--pz-color-fill-track-default);
    border-radius: 4px;
  }
  .pz-win__body--error {
    color: var(--pz-color-text-critical-default);
  }
  .pz-win__body--busy {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding-top: 10px;
    padding-bottom: 10px;
    overflow: hidden;
  }
  .pz-win__prep {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding-top: 12px;
  }
  .pz-win__prep-note {
    margin: 0;
    font-size: 11px;
    line-height: 1.4;
    color: var(--pz-color-text-base-subdued);
  }
  button.pz-win__btn {
    all: unset;
    box-sizing: border-box;
    width: 26px;
    height: 26px;
    border-radius: 7px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 10px;
    font-weight: 600;
    color: var(--pz-color-text-base-default);
    cursor: pointer;
  }
  button.pz-win__btn:disabled {
    opacity: 0.35;
    cursor: default;
  }
  button.pz-win__btn--nav {
    width: 22px;
  }
  button.pz-win__btn--primary {
    width: 34px;
    margin-left: auto;
    background: var(--pz-color-fill-brand-default);
    color: var(--pz-color-button-primary-content-default);
  }
  button.pz-win__btn--muted {
    color: var(--pz-color-text-base-subdued);
  }
  button.pz-win__btn:focus-visible {
    outline: none;
  }
  @media (hover: hover) and (pointer: fine) {
    button.pz-win__btn:hover:not(:disabled) {
      background: var(--pz-color-fill-hover-default);
    }
    button.pz-win__btn--primary:hover {
      background: var(--pz-color-text-brand-strong);
    }
  }
`;

export const RESULT_WINDOW_STYLE = WINDOW_STYLE + LOADING_STYLE;

export function button(
  iconName: IconName | null,
  text: string | null,
  label: string,
  onActivate: () => void,
  modifier?: "nav" | "primary" | "muted",
): HTMLButtonElement {
  const el = document.createElement("button");
  el.type = "button";
  el.className = `pz-win__btn${modifier !== undefined ? ` pz-win__btn--${modifier}` : ""}`;
  el.setAttribute("aria-label", label);
  el.dataset.tip = label;
  el.innerHTML = iconName !== null ? icon(iconName, 14) : (text ?? "");
  el.addEventListener("mousedown", (event) => event.preventDefault());
  el.addEventListener("click", (event) => {
    event.stopPropagation();
    onActivate();
  });
  return el;
}

export function relabelButton(target: HTMLButtonElement, iconName: IconName, label: string): void {
  target.setAttribute("aria-label", label);
  target.dataset.tip = label;
  target.innerHTML = icon(iconName, 14);
}

export interface FailedWriteButtons {
  action: HTMLButtonElement;
  cancel: HTMLButtonElement;
  idleIcon: IconName;
  idleLabel: string;
  retryLabel: string;
}

export function settleButtonsAfterFailedWrite(
  recovery: WriteFailureRecovery,
  { action, cancel, idleIcon, idleLabel, retryLabel }: FailedWriteButtons,
): HTMLButtonElement {
  action.disabled = recovery === "blocked" || !navigator.onLine;
  cancel.disabled = false;
  if (recovery === "retry") {
    relabelButton(action, "retry", retryLabel);
  } else {
    relabelButton(action, idleIcon, idleLabel);
  }
  return recovery === "retry" && !action.disabled ? action : cancel;
}

export class ResultWindow {
  private readonly element: HTMLDivElement;
  private readonly topBar: HTMLDivElement;
  private readonly bodyWrap: HTMLDivElement;
  private readonly bottomBar: HTMLDivElement;
  private readonly slowHintTimer = new SlowHintTimer();
  private wasBusy = false;
  private busyBody: HTMLElement | null = null;
  private preparingBar: HTMLElement | null = null;
  private applySaveAvailability: ((online: boolean) => void) | null = null;

  constructor(private readonly callbacks: ResultWindowCallbacks) {
    this.element = document.createElement("div");
    this.element.className = "pz-win";
    this.element.setAttribute("role", "dialog");
    this.element.setAttribute("aria-label", "Promptizer result");
    this.element.dataset.open = "false";

    this.topBar = document.createElement("div");
    this.topBar.className = "pz-win__bar pz-win__bar--top";
    this.bodyWrap = document.createElement("div");
    this.bodyWrap.className = "pz-win__bodywrap";
    this.bottomBar = document.createElement("div");
    this.bottomBar.className = "pz-win__bar pz-win__bar--bottom";

    this.element.append(this.topBar, this.bodyWrap, this.bottomBar);
  }

  node(): HTMLDivElement {
    return this.element;
  }

  render(state: ChipState): void {
    if (
      state.view.kind === "preparing" &&
      this.preparingBar !== null &&
      updateProgressBar(this.preparingBar, state.view.percent)
    ) {
      return;
    }
    this.preparingBar = null;
    this.applySaveAvailability = null;
    const open =
      state.view.kind === "loading" ||
      state.view.kind === "preparing" ||
      state.view.kind === "result" ||
      state.view.kind === "editing" ||
      state.view.kind === "tweak" ||
      state.view.kind === "error" ||
      state.view.kind === "saving";
    const isBusy = state.view.kind === "loading" || state.view.kind === "preparing";
    const settlesIn = this.wasBusy && !isBusy;
    this.wasBusy = isBusy;
    this.slowHintTimer.cancel();
    this.busyBody = null;
    this.bottomBar.classList.remove("pz-settle");
    this.element.dataset.open = String(open);
    this.topBar.replaceChildren();
    this.bottomBar.replaceChildren();
    this.bodyWrap.replaceChildren();
    if (!open) {
      return;
    }
    if (state.view.kind === "loading") {
      this.slowHintTimer.start(() => this.showSlowHint());
    }

    switch (state.view.kind) {
      case "loading":
        this.renderLoading(state.view.action);
        break;
      case "preparing":
        this.renderPreparing(state.view.percent);
        break;
      case "error":
        this.renderError(state.view.action, state.view.message);
        break;
      case "saving":
        this.renderSaving(state.view.draft);
        break;
      default:
        this.renderResult(state);
    }
    if (settlesIn) {
      this.settleInContent();
    }
  }

  destroy(): void {
    this.slowHintTimer.cancel();
    this.preparingBar = null;
    this.busyBody = null;
  }

  focusPrimary(): void {
    this.element.querySelector<HTMLButtonElement>(".pz-win__btn--primary")?.focus();
  }

  focusRetry(): void {
    this.element.querySelector<HTMLButtonElement>('[data-tip="Try again"]')?.focus();
  }

  private showSlowHint(): void {
    this.busyBody?.append(createSlowHint());
  }

  private settleInContent(): void {
    const content = [this.bodyWrap.firstElementChild, this.bottomBar];
    content.forEach((element, step) => {
      if (element instanceof HTMLElement) {
        applySettleIn(element, step);
      }
    });
  }

  private renderLoading(action: ActionId): void {
    const title = document.createElement("span");
    title.className = "pz-win__title";
    title.append(createBusyLabel(ACTION_COPY[action].busyLabel));
    const trailing = document.createElement("span");
    trailing.className = "pz-win__trailing";
    trailing.append(button("close", null, "Close", this.callbacks.onClose, "muted"));
    this.topBar.append(document.createElement("span"), title, trailing);

    const body = document.createElement("div");
    body.className = "pz-win__body pz-win__body--busy";
    body.setAttribute("role", "status");
    body.append(createShimmerLines(SKELETON_LINE_WIDTHS));
    this.bodyWrap.append(body);
    this.busyBody = body;
  }

  private renderPreparing(percent: number): void {
    const title = document.createElement("span");
    title.className = "pz-win__title";
    title.textContent = PREPARING_TITLE;
    const trailing = document.createElement("span");
    trailing.className = "pz-win__trailing";
    trailing.append(button("close", null, "Close", this.callbacks.onClose, "muted"));
    this.topBar.append(document.createElement("span"), title, trailing);

    const body = document.createElement("div");
    body.className = "pz-win__body pz-win__prep";
    const note = document.createElement("p");
    note.className = "pz-win__prep-note";
    note.textContent = PREPARING_CAPTION;
    const bar = createProgressBar(percent, PREPARING_MODEL_NAME);
    this.preparingBar = bar;
    body.append(bar, note);
    this.bodyWrap.append(body);
  }

  private renderError(action: ActionId, message: string): void {
    const title = document.createElement("span");
    title.className = "pz-win__title";
    title.textContent = ACTION_COPY[action].label;
    const trailing = document.createElement("span");
    trailing.className = "pz-win__trailing";
    trailing.append(button("close", null, "Close", this.callbacks.onClose, "muted"));
    this.topBar.append(document.createElement("span"), title, trailing);

    const body = document.createElement("div");
    body.className = "pz-win__body pz-win__body--error";
    body.setAttribute("role", "alert");
    body.textContent = message;
    this.bodyWrap.append(body);

    this.bottomBar.append(button("retry", null, "Try again", this.callbacks.onRetry));
  }

  private renderSaving(draft: string): void {
    const title = document.createElement("span");
    title.className = "pz-win__title";
    title.textContent = "Save prompt";
    const trailing = document.createElement("span");
    trailing.className = "pz-win__trailing";
    trailing.append(button("close", null, "Close", this.callbacks.onSaveCancel, "muted"));
    this.topBar.append(document.createElement("span"), title, trailing);

    const body = document.createElement("div");
    body.className = "pz-win__body";
    const titleInput = document.createElement("input");
    titleInput.type = "text";
    titleInput.setAttribute("aria-label", "Prompt title");
    titleInput.placeholder = "Title";
    titleInput.value = prefillTitle(draft);
    titleInput.style.width = "100%";
    titleInput.style.boxSizing = "border-box";
    titleInput.style.border = "0";
    titleInput.style.outline = "0";
    titleInput.style.background = "transparent";
    titleInput.style.font = "inherit";
    titleInput.style.fontSize = "13px";
    titleInput.style.color = "inherit";
    body.append(titleInput);
    const errorLine = document.createElement("p");
    errorLine.className = "pz-win__body--error";
    errorLine.setAttribute("role", "alert");
    errorLine.style.margin = "8px 0 0";
    errorLine.style.fontSize = "11px";
    body.append(errorLine);
    const offlineNote = document.createElement("p");
    offlineNote.setAttribute("role", "status");
    offlineNote.style.margin = "8px 0 0";
    offlineNote.style.fontSize = "11px";
    offlineNote.textContent = OFFLINE_SAVE_MESSAGE;
    body.append(offlineNote);
    this.bodyWrap.append(body);

    const cancelButton = button("close", null, "Cancel", this.callbacks.onSaveCancel);
    const saveButton = button("check", null, "Save prompt", () => void handleSave(), "primary");
    this.bottomBar.append(cancelButton, saveButton);

    let saveSettled = false;
    let saveInFlight = false;
    let saveBlocked = false;
    const applyAvailability = (online: boolean): void => {
      offlineNote.hidden = online;
      if (!saveInFlight && !saveSettled && !saveBlocked) {
        saveButton.disabled = !online;
      }
      if (online && errorLine.textContent === OFFLINE_SAVE_MESSAGE) {
        errorLine.textContent = UNREACHABLE_WRITE_MESSAGE;
      }
    };
    this.applySaveAvailability = applyAvailability;
    applyAvailability(navigator.onLine);

    const handleSave = async (): Promise<void> => {
      if (saveInFlight || saveSettled || saveBlocked) {
        return;
      }
      errorLine.textContent = "";
      saveInFlight = true;
      saveButton.disabled = true;
      cancelButton.disabled = true;
      const outcome = await this.callbacks.onSaveConfirm(titleInput.value.trim() || "Untitled prompt");
      saveInFlight = false;
      if (outcome.ok) {
        saveSettled = true;
        saveButton.innerHTML = "";
        saveButton.append(document.createTextNode("Saved"));
        saveButton.setAttribute("aria-label", "Saved");
        saveButton.dataset.tip = "Saved";
        if (outcome.showFirstSaveNotice) {
          cancelButton.disabled = false;
          cancelButton.innerHTML = "";
          cancelButton.append(document.createTextNode("Done"));
          cancelButton.setAttribute("aria-label", "Done");
          cancelButton.dataset.tip = "Done";
          errorLine.classList.remove("pz-win__body--error");
          errorLine.setAttribute("role", "status");
          errorLine.textContent = "Stored in your Promptizer account.";
          return;
        }
        window.setTimeout(() => this.callbacks.onSaveCancel(), SAVE_CONFIRM_FLASH_MS);
        return;
      }
      saveBlocked = outcome.recovery === "blocked";
      errorLine.textContent = outcome.message;
      const buttonToFocus = settleButtonsAfterFailedWrite(outcome.recovery, {
        action: saveButton,
        cancel: cancelButton,
        idleIcon: "check",
        idleLabel: "Save prompt",
        retryLabel: "Retry save",
      });
      (outcome.recovery === "fix-input" ? titleInput : buttonToFocus).focus();
    };

    window.setTimeout(() => titleInput.focus(), 0);
  }

  syncSaveAvailability(online: boolean): void {
    this.applySaveAvailability?.(online);
  }

  focusTitle(): void {
    this.element.querySelector<HTMLInputElement>('input[aria-label="Prompt title"]')?.focus();
  }

  private renderResult(state: ChipState): void {
    const entry = currentResult(state);
    if (entry === null) {
      return;
    }
    const total = state.results.length;
    const index = state.index;

    const prev = button("back", null, "Previous result", () => this.callbacks.onStep(-1), "nav");
    prev.disabled = index <= 0;
    const next = button("fwd", null, "Next result", () => this.callbacks.onStep(1), "nav");
    next.disabled = index >= total - 1;
    const counter = document.createElement("span");
    counter.className = "pz-win__counter";
    counter.textContent = `${index + 1}/${total}`;
    const leading = document.createElement("span");
    leading.className = "pz-win__leading";
    leading.append(prev, counter, next);

    const title = document.createElement("span");
    title.className = "pz-win__title";
    title.textContent = entry.title;
    if (entry.edited) {
      const badge = document.createElement("span");
      badge.className = "pz-win__edited";
      badge.textContent = "Edited";
      title.append(" ", badge);
    }

    const trailing = document.createElement("span");
    trailing.className = "pz-win__trailing";
    trailing.append(
      button("trash", null, "Delete result", this.callbacks.onDeleteCurrent, "muted"),
      button("close", null, "Close", this.callbacks.onClose, "muted"),
    );
    this.topBar.append(leading, title, trailing);

    if (state.view.kind === "editing") {
      const textarea = document.createElement("textarea");
      textarea.className = "pz-win__body";
      textarea.setAttribute("aria-label", "Edit result");
      textarea.spellcheck = false;
      textarea.value = entry.text;
      this.bodyWrap.append(textarea);

      this.bottomBar.append(
        button("close", null, "Discard edit", this.callbacks.onEditDiscard),
        button("check", null, "Save edit", () => this.callbacks.onEditSave(textarea.value), "primary"),
      );
      return;
    }

    const body = document.createElement("div");
    body.className = "pz-win__body";
    body.textContent = entry.text;
    body.setAttribute("role", "button");
    body.tabIndex = 0;
    body.addEventListener("click", () => this.callbacks.onEditStart(), { once: true });
    this.bodyWrap.append(body);

    if (state.view.kind === "tweak") {
      const back = button("back", null, "Back", this.callbacks.onTweakToggle);
      this.bottomBar.append(back);
      for (const leaf of TWEAK_LEAVES) {
        this.bottomBar.append(
          button(leaf === "vi" || leaf === "en" ? null : iconFor(leaf), leafText(leaf), ACTION_COPY[leaf].label, () =>
            this.callbacks.onRunTweak(leaf),
          ),
        );
      }
      return;
    }

    this.bottomBar.append(
      button("edit", null, "Edit", this.callbacks.onEditStart),
      button("tweak", null, "Tweak", this.callbacks.onTweakToggle),
    );
    if (entry.action !== LIBRARY_ORIGIN) {
      this.bottomBar.append(button("retry", null, "Regenerate", this.callbacks.onRegenerate));
    }
    this.bottomBar.append(
      button("copy", null, state.copied ? "Copied" : "Copy", this.callbacks.onCopy),
      button("replace", null, "Replace text", this.callbacks.onReplace, "primary"),
    );
  }
}

function iconFor(action: ActionId): IconName | null {
  const map: Partial<Record<ActionId, IconName>> = {
    shorten: "shorten",
    grammar: "grammar",
    pro: "pro",
    friendly: "friendly",
    direct: "direct",
  };
  return map[action] ?? null;
}

function leafText(action: ActionId): string | null {
  return action === "vi" ? "VI" : action === "en" ? "EN" : null;
}
