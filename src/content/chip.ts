import { browser } from "wxt/browser";
import designTokens from "../styles/tokens.css?inline";
import { icon } from "../utils/icons";
import { RAIL_STYLE } from "./rail";
import { WINDOW_STYLE } from "./result-window";
import type { PanelPlacement } from "./anchor";

const CHIP_SIZE = 28;
const UNDO_GAP = 6;
const VIEWPORT_MARGIN = 6;
const CORNER_INSET = 4;

const CHIP_STYLE = `
  :host {
    all: initial;
  }
  .pz-root,
  .pz-root *,
  .pz-root *::before,
  .pz-root *::after {
    box-sizing: border-box;
  }
  .pz-root {
    font-family: var(--pz-font-family-sans-default);
    position: relative;
    display: flex;
    align-items: center;
    gap: ${UNDO_GAP}px;
  }
  .pz-chip {
    all: unset;
    box-sizing: border-box;
    position: relative;
    width: ${CHIP_SIZE}px;
    height: ${CHIP_SIZE}px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--pz-color-background-base-floating);
    border: 1px solid var(--pz-color-border-base-floating);
    box-shadow: var(--pz-elevation-base-low);
    color: var(--pz-color-text-base-default);
    cursor: pointer;
  }
  .pz-chip[hidden] {
    display: none;
  }
  .pz-chip::before {
    content: "";
    position: absolute;
    inset: -8px;
  }
  .pz-chip:hover,
  .pz-chip[aria-expanded="true"] {
    background: var(--pz-color-background-base-floating-hover);
  }
  .pz-chip:focus-visible {
    outline: none;
  }
  .pz-chip img {
    width: 14px;
    height: 14px;
    display: block;
    pointer-events: none;
  }
  .pz-chip > svg:not(.pz-chip__ring) {
    width: 14px;
    height: 14px;
    display: block;
    pointer-events: none;
  }
  .pz-chip__ring {
    position: absolute;
    inset: 2px;
    width: 22px;
    height: 22px;
    display: none;
  }
  .pz-chip[data-loading="true"] .pz-chip__ring {
    display: block;
  }
  .pz-chip__ring path {
    stroke: var(--pz-color-fill-brand-default);
    transform-origin: 11px 11px;
    animation: pz-chip-spin 0.9s linear infinite;
  }
  .pz-chip[data-loading="true"] {
    animation: pz-chip-pulse 1.1s ease-in-out infinite;
  }
  .pz-root[data-enter="true"] {
    animation: pz-chip-pop 140ms ease-out;
  }
  .pz-root[data-exit="true"] {
    animation: pz-chip-pop 120ms ease-in reverse forwards;
  }
  @keyframes pz-chip-spin {
    to {
      transform: rotate(360deg);
    }
  }
  @keyframes pz-chip-pulse {
    0%,
    100% {
      transform: scale(1);
    }
    50% {
      transform: scale(1.06);
    }
  }
  @keyframes pz-chip-pop {
    from {
      opacity: 0;
      transform: translateY(6px) scale(0.92);
    }
    to {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .pz-chip__ring path {
      animation-duration: 1.8s;
    }
    .pz-chip[data-loading="true"],
    .pz-root[data-enter="true"],
    .pz-root[data-exit="true"] {
      animation: none;
    }
  }
`;

const RING_SVG =
  '<svg class="pz-chip__ring" aria-hidden="true" viewBox="0 0 22 22" fill="none"><path d="M11 1a10 10 0 0 1 10 10" stroke-width="2" stroke-linecap="round"/></svg>';

export class PromptizerChip {
  private readonly host: HTMLDivElement;
  private readonly root: HTMLDivElement;
  private readonly undoButton: HTMLButtonElement;
  private readonly trigger: HTMLButtonElement;
  private visible = false;
  private exitTimeout: ReturnType<typeof setTimeout> | undefined;

  constructor(
    private readonly onTriggerClick: () => void,
    private readonly onEscape: () => void,
    private readonly onUndoClick: () => void,
  ) {
    this.host = document.createElement("div");
    this.host.style.position = "fixed";
    this.host.style.bottom = "0px";
    this.host.style.right = "0px";
    this.host.style.zIndex = "2147483647";
    this.host.style.display = "none";
    this.host.setAttribute("data-promptizer-pill", "");

    const shadow = this.host.attachShadow({ mode: "closed" });
    const style = document.createElement("style");
    style.textContent = designTokens + CHIP_STYLE + RAIL_STYLE + WINDOW_STYLE;

    this.root = document.createElement("div");
    this.root.className = "pz-root";

    this.undoButton = document.createElement("button");
    this.undoButton.type = "button";
    this.undoButton.className = "pz-chip";
    this.undoButton.hidden = true;
    this.undoButton.setAttribute("aria-label", "Undo replace");
    this.undoButton.title = "Undo replace";
    this.undoButton.innerHTML = icon("undo", 14);
    this.undoButton.addEventListener("mousedown", (event) => event.preventDefault());
    this.undoButton.addEventListener("click", (event) => {
      event.stopPropagation();
      this.onUndoClick();
    });

    this.trigger = document.createElement("button");
    this.trigger.type = "button";
    this.trigger.className = "pz-chip";
    this.trigger.setAttribute("aria-haspopup", "menu");
    this.trigger.setAttribute("aria-expanded", "false");
    this.trigger.setAttribute("aria-label", "Promptizer actions");
    this.trigger.title = "Promptizer actions";
    this.trigger.innerHTML = `<img alt="" src="${browser.runtime.getURL("/chip/mark.png")}">${RING_SVG}`;
    this.trigger.addEventListener("mousedown", (event) => event.preventDefault());
    this.trigger.addEventListener("click", (event) => {
      event.stopPropagation();
      this.onTriggerClick();
    });

    this.root.append(this.undoButton, this.trigger);
    this.root.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        this.onEscape();
      }
    });
    shadow.append(style, this.root);
  }

  attachRail(node: HTMLElement): void {
    this.root.append(node);
  }

  attachWindow(node: HTMLElement): void {
    this.root.append(node);
  }

  setLoading(loading: boolean): void {
    this.trigger.dataset.loading = String(loading);
  }

  setExpanded(expanded: boolean): void {
    this.trigger.setAttribute("aria-expanded", String(expanded));
  }

  setUndoVisible(visible: boolean): void {
    this.undoButton.hidden = !visible;
  }

  focusTrigger(): void {
    this.trigger.focus();
  }

  focusUndo(): void {
    this.undoButton.focus();
  }

  anchorRect(): DOMRect {
    return this.trigger.getBoundingClientRect();
  }

  applyPanelPlacement(panel: HTMLElement, placement: PanelPlacement): void {
    panel.style.right = `${placement.rightInset}px`;
    panel.style.bottom = `${placement.bottomInset}px`;
    panel.style.maxWidth = `${placement.maxWidth}px`;
  }

  mount(): void {
    if (!document.documentElement.contains(this.host)) {
      document.documentElement.append(this.host);
    }
  }

  destroy(): void {
    this.host.remove();
  }

  containsEventTarget(event: Event): boolean {
    return event.composedPath().includes(this.host);
  }

  positionAtBottomRight(rect: DOMRect): void {
    const rightInset = Math.max(VIEWPORT_MARGIN, window.innerWidth - rect.right + CORNER_INSET);
    const bottomInset = Math.max(VIEWPORT_MARGIN, window.innerHeight - rect.bottom + CORNER_INSET);
    this.host.style.right = `${rightInset}px`;
    this.host.style.bottom = `${bottomInset}px`;
  }

  show(): void {
    if (this.exitTimeout !== undefined) {
      clearTimeout(this.exitTimeout);
      this.exitTimeout = undefined;
    }
    const wasHidden = !this.visible;
    this.host.style.display = "block";
    this.root.removeAttribute("data-exit");
    if (wasHidden) {
      this.root.setAttribute("data-enter", "true");
    }
    this.visible = true;
  }

  hide(): void {
    if (!this.visible) {
      return;
    }
    this.visible = false;
    this.root.removeAttribute("data-enter");
    this.root.setAttribute("data-exit", "true");
    this.exitTimeout = setTimeout(() => {
      this.host.style.display = "none";
      this.root.removeAttribute("data-exit");
      this.exitTimeout = undefined;
    }, 120);
  }

  isVisible(): boolean {
    return this.visible;
  }
}
