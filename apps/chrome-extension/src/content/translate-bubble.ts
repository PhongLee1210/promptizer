import designTokens from "../styles/tokens.css?inline";
import { icon } from "../utils/icons";
import { PANEL_GAP, placePanel } from "./anchor";
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
import type { Rect, Viewport } from "./anchor";
import type { TranslationDirection } from "./translator";

export type BubbleState =
  | { kind: "detecting" }
  | { kind: "downloading"; percent: number }
  | { kind: "translating" }
  | { kind: "ready"; direction: TranslationDirection; text: string }
  | { kind: "unsupported-language" }
  | { kind: "unavailable" }
  | { kind: "error" };

export interface TranslateBubbleCallbacks {
  onCopy: () => void;
  onClose: () => void;
}

export const BUBBLE_HEIGHT = 220;
const MAX_Z_INDEX = "2147483647";
const HOST_ATTRIBUTE = "data-promptizer-translate";
const BUTTON_SIZE = 28;
const BUTTON_ICON_SIZE = 14;
const CONTROL_ICON_SIZE = 14;
const BUTTON_GAP = 6;
const VIEWPORT_MARGIN = 6;
const BUBBLE_SKELETON_WIDTHS = ["92%", "78%", "54%"] as const;
const DOWNLOAD_LABEL = "Downloading language models";

const LANGUAGE_NAMES: Record<TranslationDirection["source"], string> = {
  en: "English",
  vi: "Vietnamese",
};

export const TRANSLATE_BUBBLE_STYLE = `
  :host {
    all: initial;
  }
  .pz-translate-button,
  .pz-translate-bubble,
  .pz-translate-bubble * {
    box-sizing: border-box;
  }
  .pz-translate-button {
    all: unset;
    box-sizing: border-box;
    width: ${BUTTON_SIZE}px;
    height: ${BUTTON_SIZE}px;
    border-radius: var(--pz-radius-full);
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--pz-color-background-base-floating);
    border: 1px solid var(--pz-color-border-base-floating);
    box-shadow: var(--pz-elevation-base-low);
    color: var(--pz-color-text-base-default);
    cursor: pointer;
    transition: background var(--pz-dur-fast) linear;
  }
  .pz-translate-button:hover {
    background: var(--pz-color-background-base-floating-hover);
  }
  .pz-translate-button:focus-visible {
    outline: 2px solid var(--pz-color-border-focus-default);
  }
  .pz-translate-button svg,
  .pz-translate-control svg {
    display: block;
    pointer-events: none;
  }
  .pz-translate-bubble {
    width: 100%;
    max-height: ${BUBBLE_HEIGHT}px;
    display: flex;
    flex-direction: column;
    gap: var(--pz-space-2);
    padding: var(--pz-space-3);
    border-radius: var(--pz-radius-medium);
    background: var(--pz-color-background-base-floating);
    border: 1px solid var(--pz-color-border-base-floating);
    box-shadow: var(--pz-elevation-base-medium);
    color: var(--pz-color-text-base-default);
    font-family: var(--pz-font-family-sans-default);
  }
  .pz-translate-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--pz-space-2);
  }
  .pz-translate-live {
    display: flex;
    flex-direction: column;
    min-height: 0;
  }
  .pz-translate-direction {
    font-size: var(--pz-text-size-xsmall);
    line-height: var(--pz-line-height-text-xsmall);
    font-weight: var(--pz-font-weight-medium);
    color: var(--pz-color-text-base-muted);
  }
  .pz-translate-actions {
    display: flex;
    align-items: center;
    gap: var(--pz-space-half);
    margin-left: auto;
  }
  .pz-translate-control {
    all: unset;
    box-sizing: border-box;
    width: var(--pz-size-control-small);
    height: var(--pz-size-control-small);
    border-radius: var(--pz-radius-small);
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--pz-color-text-base-subdued);
    cursor: pointer;
  }
  .pz-translate-control:hover {
    background: var(--pz-color-fill-hover-default);
    color: var(--pz-color-text-base-default);
  }
  .pz-translate-control:focus-visible {
    outline: 2px solid var(--pz-color-border-focus-default);
  }
  .pz-translate-text {
    margin: 0;
    overflow-y: auto;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
    font-size: var(--pz-text-size-small);
    line-height: var(--pz-line-height-text-small);
    color: var(--pz-color-text-base-default);
  }
  .pz-translate-status {
    margin: 0;
    font-size: var(--pz-text-size-small);
    line-height: var(--pz-line-height-text-small);
    color: var(--pz-color-text-base-subdued);
  }
  .pz-translate-status[data-tone="error"] {
    color: var(--pz-color-text-critical-default);
  }
  .pz-translate-busy {
    display: flex;
    flex-direction: column;
    gap: var(--pz-space-2);
  }
  .pz-translate-busy .pz-load__label {
    font-size: var(--pz-text-size-small);
    line-height: var(--pz-line-height-text-small);
    color: var(--pz-color-text-base-subdued);
  }
  @media (prefers-reduced-motion: reduce) {
    .pz-translate-button {
      transition: none;
    }
  }
`;

function createShadowHost(): { host: HTMLDivElement; shadow: ShadowRoot } {
  const host = document.createElement("div");
  host.setAttribute(HOST_ATTRIBUTE, "");
  host.setAttribute("popover", "manual");
  host.style.position = "fixed";
  host.style.top = "auto";
  host.style.right = "auto";
  host.style.bottom = "auto";
  host.style.left = "auto";
  host.style.margin = "0";
  host.style.border = "0";
  host.style.padding = "0";
  host.style.overflow = "visible";
  host.style.background = "transparent";
  host.style.color = "inherit";
  host.style.zIndex = MAX_Z_INDEX;

  const shadow = host.attachShadow({ mode: "closed" });
  const style = document.createElement("style");
  style.textContent = designTokens + TRANSLATE_BUBBLE_STYLE + LOADING_STYLE;
  shadow.append(style);
  return { host, shadow };
}

function attachAndShow(host: HTMLDivElement): void {
  if (!document.documentElement.contains(host)) {
    document.documentElement.append(host);
  }
  if (typeof host.showPopover === "function") {
    host.showPopover();
  }
}

function describeDirection(direction: TranslationDirection): string {
  return `${LANGUAGE_NAMES[direction.source]} → ${LANGUAGE_NAMES[direction.target]}`;
}

function createControl(label: string, iconName: "copy" | "close", onClick: () => void): HTMLButtonElement {
  const control = document.createElement("button");
  control.type = "button";
  control.className = "pz-translate-control";
  control.setAttribute("aria-label", label);
  control.title = label;
  control.innerHTML = icon(iconName, CONTROL_ICON_SIZE);
  control.addEventListener("mousedown", (event) => event.preventDefault());
  control.addEventListener("click", (event) => {
    event.stopPropagation();
    onClick();
  });
  return control;
}

function createStatus(message: string, tone?: "error"): HTMLParagraphElement {
  const status = document.createElement("p");
  status.className = "pz-translate-status";
  status.textContent = message;
  if (tone !== undefined) {
    status.dataset.tone = tone;
  }
  return status;
}

export class TranslateButton {
  private readonly host: HTMLDivElement;

  constructor(onClick: () => void) {
    const { host, shadow } = createShadowHost();
    this.host = host;

    const button = document.createElement("button");
    button.type = "button";
    button.className = "pz-translate-button";
    button.setAttribute("aria-label", "Translate selection");
    button.title = "Translate selection";
    button.innerHTML = icon("globe", BUTTON_ICON_SIZE);
    button.addEventListener("mousedown", (event) => event.preventDefault());
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      onClick();
    });
    shadow.append(button);
  }

  node(): HTMLDivElement {
    return this.host;
  }

  mountAt(rect: Rect): void {
    const highestLeft = Math.max(window.innerWidth - BUTTON_SIZE - VIEWPORT_MARGIN, VIEWPORT_MARGIN);
    const highestTop = Math.max(window.innerHeight - BUTTON_SIZE - VIEWPORT_MARGIN, VIEWPORT_MARGIN);
    const left = Math.min(Math.max(rect.right, VIEWPORT_MARGIN), highestLeft);
    const top = Math.min(Math.max(rect.bottom + BUTTON_GAP, VIEWPORT_MARGIN), highestTop);
    this.host.style.left = `${left}px`;
    this.host.style.top = `${top}px`;
    attachAndShow(this.host);
  }

  destroy(): void {
    this.host.remove();
  }

  containsEventTarget(event: Event): boolean {
    return event.composedPath().includes(this.host);
  }
}

export class TranslateBubble {
  private readonly host: HTMLDivElement;
  private readonly root: HTMLDivElement;
  private readonly header: HTMLDivElement;
  private readonly liveRegion: HTMLDivElement;
  private readonly slowHintTimer = new SlowHintTimer();
  private renderedKind: BubbleState["kind"] | null = null;
  private busyContent: HTMLElement | null = null;
  private downloadBar: HTMLElement | null = null;

  constructor(private readonly callbacks: TranslateBubbleCallbacks) {
    const { host, shadow } = createShadowHost();
    this.host = host;
    this.root = document.createElement("div");
    this.root.className = "pz-translate-bubble";
    this.root.setAttribute("role", "dialog");
    this.root.setAttribute("aria-label", "Translation");
    this.header = document.createElement("div");
    this.header.className = "pz-translate-header";
    this.liveRegion = document.createElement("div");
    this.liveRegion.className = "pz-translate-live";
    this.liveRegion.setAttribute("aria-live", "polite");
    this.liveRegion.setAttribute("aria-atomic", "true");
    this.root.append(this.header, this.liveRegion);
    shadow.append(this.root);
    this.render({ kind: "detecting" });
  }

  node(): HTMLDivElement {
    return this.host;
  }

  mount(): void {
    attachAndShow(this.host);
  }

  render(state: BubbleState): void {
    if (
      state.kind === "downloading" &&
      this.downloadBar !== null &&
      updateProgressBar(this.downloadBar, Math.round(state.percent))
    ) {
      return;
    }
    this.downloadBar = null;
    const kindChanged = state.kind !== this.renderedKind;
    this.renderedKind = state.kind;
    this.slowHintTimer.cancel();
    this.busyContent = null;
    const actions = document.createElement("div");
    actions.className = "pz-translate-actions";

    const headerChildren: HTMLElement[] = [];
    const body: HTMLElement[] = [];
    if (state.kind === "ready") {
      const direction = document.createElement("span");
      direction.className = "pz-translate-direction";
      direction.textContent = describeDirection(state.direction);
      headerChildren.push(direction);
      actions.append(createControl("Copy translation", "copy", this.callbacks.onCopy));

      const text = document.createElement("p");
      text.className = "pz-translate-text";
      text.textContent = state.text;
      body.push(text);
    } else {
      body.push(this.statusFor(state));
    }

    actions.append(createControl("Close translation", "close", this.callbacks.onClose));
    headerChildren.push(actions);
    this.header.replaceChildren(...headerChildren);
    this.liveRegion.replaceChildren(...body);
    if (kindChanged) {
      body.forEach((element) => applySettleIn(element));
    }
    if (this.busyContent !== null) {
      this.slowHintTimer.start(() => this.busyContent?.append(createSlowHint()));
    }
  }

  positionAt(rect: Rect, viewport: Viewport): void {
    const placement = placePanel(rect, BUBBLE_HEIGHT, viewport);
    this.host.style.right = `${placement.rightInset}px`;
    if (placement.placement === "below") {
      const highestTop = Math.max(viewport.height - VIEWPORT_MARGIN, VIEWPORT_MARGIN);
      this.host.style.top = `${Math.min(Math.max(rect.bottom + PANEL_GAP, VIEWPORT_MARGIN), highestTop)}px`;
      this.host.style.bottom = "auto";
    } else {
      this.host.style.top = "auto";
      this.host.style.bottom = `${placement.bottomInset}px`;
    }
    this.host.style.maxWidth = `${placement.maxWidth}px`;
    this.host.style.width = `${placement.maxWidth}px`;
  }

  containsEventTarget(event: Event): boolean {
    return event.composedPath().includes(this.host);
  }

  destroy(): void {
    this.slowHintTimer.cancel();
    this.downloadBar = null;
    this.busyContent = null;
    this.host.remove();
  }

  private createBusyContent(children: HTMLElement[]): HTMLDivElement {
    const content = document.createElement("div");
    content.className = "pz-translate-busy";
    content.append(...children);
    this.busyContent = content;
    return content;
  }

  private statusFor(state: Exclude<BubbleState, { kind: "ready" }>): HTMLElement {
    switch (state.kind) {
      case "detecting":
        return this.createBusyContent([
          createBusyLabel("Detecting language"),
          createShimmerLines(BUBBLE_SKELETON_WIDTHS),
        ]);
      case "downloading":
        const bar = createProgressBar(Math.round(state.percent), DOWNLOAD_LABEL);
        this.downloadBar = bar;
        return this.createBusyContent([bar]);
      case "translating":
        return this.createBusyContent([createBusyLabel("Translating"), createShimmerLines(BUBBLE_SKELETON_WIDTHS)]);
      case "unsupported-language":
        return createStatus("Only English and Vietnamese are supported.");
      case "unavailable":
        return createStatus("Translation is unavailable on this device.");
      case "error":
        return createStatus("Translation failed. Try again.", "error");
    }
  }
}
