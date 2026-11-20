import { browser } from "wxt/browser";
import designTokens from "../styles/tokens.css?inline";
import { icon } from "../utils/icons";
import { RAIL_STYLE } from "./rail";
import { WINDOW_STYLE } from "./result-window";
import { CHIP_MAX_SIZE, placeChip } from "./anchor";
import type { EdgeInsets, PanelPlacement } from "./anchor";

const UNDO_GAP = 6;
const ICON_RATIO = 14 / CHIP_MAX_SIZE;
const RING_RATIO = 22 / CHIP_MAX_SIZE;

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
    --pz-chip-size: ${CHIP_MAX_SIZE}px;
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
    width: var(--pz-chip-size);
    height: var(--pz-chip-size);
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--pz-color-background-base-floating);
    border: 1px solid var(--pz-color-border-base-floating);
    box-shadow: var(--pz-elevation-base-low);
    color: var(--pz-color-text-base-default);
    cursor: pointer;
    transition:
      background var(--pz-dur-fast) linear,
      border-radius var(--pz-dur-morph) ease-in-out,
      padding var(--pz-dur-morph) ease-in-out,
      margin var(--pz-dur-morph) ease-in-out;
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
    border-radius: 100% 100% 100% 0;
  }
  .pz-chip:focus-visible {
    outline: none;
  }
  .pz-chip img {
    width: calc(var(--pz-chip-size) * ${ICON_RATIO});
    height: calc(var(--pz-chip-size) * ${ICON_RATIO});
    display: block;
    pointer-events: none;
  }
  .pz-chip > svg:not(.pz-chip__ring):not(.pz-chip__progress) {
    width: calc(var(--pz-chip-size) * ${ICON_RATIO});
    height: calc(var(--pz-chip-size) * ${ICON_RATIO});
    display: block;
    pointer-events: none;
  }
  .pz-chip__ring,
  .pz-chip__progress {
    position: absolute;
    top: 50%;
    left: 50%;
    width: calc(var(--pz-chip-size) * ${RING_RATIO});
    height: calc(var(--pz-chip-size) * ${RING_RATIO});
    transform: translate(-50%, -50%);
    display: none;
  }
  .pz-chip img,
  .pz-chip > svg:not(.pz-chip__ring):not(.pz-chip__progress) {
    transition: transform var(--pz-dur-morph) ease-in-out;
  }
  .pz-chip[data-loading="true"] img,
  .pz-chip[data-progress] img {
    transform: scale(0.78);
  }
  .pz-chip[data-loading="true"] .pz-chip__ring {
    display: block;
  }
  .pz-chip__ring path {
    stroke: var(--pz-color-fill-brand-default);
    transform-origin: 11px 11px;
    animation: pz-chip-spin 1.2s linear infinite;
  }
  .pz-chip[data-loading="true"] {
    animation: pz-chip-pulse 1.1s ease-in-out infinite;
  }
  .pz-chip[data-progress] .pz-chip__progress {
    display: block;
  }
  .pz-chip[data-progress] .pz-chip__ring {
    display: none;
  }
  .pz-chip[data-progress] {
    animation: none;
  }
  .pz-chip__progress circle {
    stroke: var(--pz-color-fill-track-translucent);
  }
  .pz-chip__progress-arc {
    stroke: var(--pz-color-fill-brand-default);
    transition: stroke-dashoffset var(--pz-dur-slow) var(--pz-ease-out);
  }
  .pz-root[data-enter="true"] {
    animation: pz-chip-pop 110ms ease-out;
  }
  .pz-root[data-exit="true"] {
    animation: pz-chip-pop 110ms ease-in reverse forwards;
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
    .pz-chip__progress-arc {
      transition: none;
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

const PROGRESS_RADIUS = 9;
const PROGRESS_CIRCUMFERENCE = 2 * Math.PI * PROGRESS_RADIUS;

const PROGRESS_SVG =
  `<svg class="pz-chip__progress" aria-hidden="true" viewBox="0 0 22 22" fill="none">` +
  `<circle cx="11" cy="11" r="${PROGRESS_RADIUS}" stroke-width="2"/>` +
  `<circle class="pz-chip__progress-arc" cx="11" cy="11" r="${PROGRESS_RADIUS}" stroke-width="2" ` +
  `stroke-linecap="round" stroke-dasharray="${PROGRESS_CIRCUMFERENCE}" stroke-dashoffset="${PROGRESS_CIRCUMFERENCE}" ` +
  `transform="rotate(-90 11 11)"/></svg>`;

function readPadding(editor: HTMLElement): EdgeInsets {
  const computed = window.getComputedStyle(editor);
  return {
    top: Number.parseFloat(computed.paddingTop) || 0,
    right: Number.parseFloat(computed.paddingRight) || 0,
    bottom: Number.parseFloat(computed.paddingBottom) || 0,
    left: Number.parseFloat(computed.paddingLeft) || 0,
  };
}

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
    this.trigger.innerHTML = `<img alt="" src="${browser.runtime.getURL("/chip/mark.png")}">${RING_SVG}${PROGRESS_SVG}`;
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

  setProgress(percent: number | null): void {
    const arc = this.trigger.querySelector<SVGCircleElement>(".pz-chip__progress-arc");
    if (percent === null) {
      delete this.trigger.dataset.progress;
      arc?.setAttribute("stroke-dashoffset", String(PROGRESS_CIRCUMFERENCE));
      this.trigger.removeAttribute("aria-valuenow");
      return;
    }
    const clamped = Math.min(100, Math.max(0, Math.round(percent)));
    this.trigger.dataset.progress = String(clamped);
    this.trigger.setAttribute("aria-valuenow", String(clamped));
    arc?.setAttribute("stroke-dashoffset", String((PROGRESS_CIRCUMFERENCE * (100 - clamped)) / 100));
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

  positionInsideEditor(editor: HTMLElement): void {
    const placement = placeChip(editor.getBoundingClientRect(), readPadding(editor), {
      width: window.innerWidth,
      height: window.innerHeight,
    });
    this.host.style.right = `${placement.rightInset}px`;
    this.host.style.bottom = `${placement.bottomInset}px`;
    this.root.style.setProperty("--pz-chip-size", `${placement.size}px`);
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
    }, 110);
  }

  isVisible(): boolean {
    return this.visible;
  }
}
