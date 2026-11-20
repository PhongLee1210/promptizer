import { icon, type IconName } from "../utils/icons";
import type { ActionId } from "./action-types";
import { currentResult, type ChipState } from "./chip-state";
import { ACTION_COPY, PREPARING_CAPTION, PREPARING_TITLE } from "./present-result";

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
}

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
    animation: pz-win-pop 140ms ease-out;
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
    gap: 9px;
    padding-top: 14px;
  }
  .pz-win__prep {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding-top: 12px;
  }
  .pz-win__prep-line {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 8px;
    font-size: 12px;
  }
  .pz-win__prep-pct {
    font-variant-numeric: tabular-nums;
    color: var(--pz-color-text-brand-strong);
  }
  .pz-win__prep-note {
    font-size: 11px;
    line-height: 1.4;
    color: var(--pz-color-text-base-subdued);
  }
  .pz-win__bar-track {
    height: 4px;
    border-radius: var(--pz-radius-half);
    background: var(--pz-color-fill-track-default);
    overflow: hidden;
  }
  .pz-win__bar-fill {
    height: 100%;
    background: var(--pz-color-fill-brand-default);
    transition: width 240ms ease-out;
  }
  .pz-win__bar-fill[data-indeterminate="true"] {
    width: 40%;
    animation: pz-win-slide 1.4s ease-in-out infinite;
  }
  @keyframes pz-win-slide {
    0% { transform: translateX(-100%); }
    100% { transform: translateX(250%); }
  }
  @media (prefers-reduced-motion: reduce) {
    .pz-win__bar-fill {
      transition: none;
    }
    .pz-win__bar-fill[data-indeterminate="true"] {
      animation: none;
    }
  }
  .pz-win__sk {
    height: 10px;
    border-radius: 5px;
    background: var(--pz-color-fill-skeleton-default);
    animation: pz-win-sk 1.1s ease-in-out infinite;
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
  @keyframes pz-win-sk {
    0%, 100% { opacity: 0.35; }
    50% { opacity: 0.8; }
  }
`;

function button(
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

export class ResultWindow {
  private readonly element: HTMLDivElement;
  private readonly topBar: HTMLDivElement;
  private readonly bodyWrap: HTMLDivElement;
  private readonly bottomBar: HTMLDivElement;

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
    const open =
      state.view.kind === "loading" ||
      state.view.kind === "preparing" ||
      state.view.kind === "result" ||
      state.view.kind === "editing" ||
      state.view.kind === "tweak" ||
      state.view.kind === "error";
    this.element.dataset.open = String(open);
    this.topBar.replaceChildren();
    this.bottomBar.replaceChildren();
    this.bodyWrap.replaceChildren();
    if (!open) {
      return;
    }

    switch (state.view.kind) {
      case "loading":
        this.renderLoading(state.view.action);
        return;
      case "preparing":
        this.renderPreparing(state.view.percent);
        return;
      case "error":
        this.renderError(state.view.action, state.view.message);
        return;
      default:
        this.renderResult(state);
    }
  }

  focusPrimary(): void {
    this.element.querySelector<HTMLButtonElement>(".pz-win__btn--primary")?.focus();
  }

  focusRetry(): void {
    this.element.querySelector<HTMLButtonElement>('[data-tip="Try again"]')?.focus();
  }

  private renderLoading(action: ActionId): void {
    const title = document.createElement("span");
    title.className = "pz-win__title";
    title.textContent = ACTION_COPY[action].busyLabel;
    const trailing = document.createElement("span");
    trailing.className = "pz-win__trailing";
    trailing.append(button("close", null, "Close", this.callbacks.onClose, "muted"));
    this.topBar.append(document.createElement("span"), title, trailing);

    const body = document.createElement("div");
    body.className = "pz-win__body pz-win__body--busy";
    body.setAttribute("role", "status");
    for (const width of ["92%", "78%", "54%"]) {
      const bar = document.createElement("span");
      bar.className = "pz-win__sk";
      bar.style.width = width;
      body.append(bar);
    }
    this.bodyWrap.append(body);
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
    body.setAttribute("role", "progressbar");
    body.setAttribute("aria-valuemin", "0");
    body.setAttribute("aria-valuemax", "100");
    body.setAttribute("aria-valuenow", String(percent));
    body.setAttribute("aria-label", PREPARING_TITLE);

    const line = document.createElement("div");
    line.className = "pz-win__prep-line";
    const label = document.createElement("span");
    label.textContent = "Gemini Nano";
    const value = document.createElement("span");
    value.className = "pz-win__prep-pct";
    value.textContent = `${percent}%`;
    line.append(label, value);

    const track = document.createElement("div");
    track.className = "pz-win__bar-track";
    const fill = document.createElement("div");
    fill.className = "pz-win__bar-fill";
    if (percent === 0) {
      fill.dataset.indeterminate = "true";
    } else {
      fill.style.width = `${percent}%`;
    }
    track.append(fill);

    const note = document.createElement("p");
    note.className = "pz-win__prep-note";
    note.textContent = PREPARING_CAPTION;

    body.append(line, track, note);
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
      button("retry", null, "Regenerate", this.callbacks.onRegenerate),
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
