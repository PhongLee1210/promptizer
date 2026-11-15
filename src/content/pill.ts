import { icon } from "../utils/icons";
import type { ActionId } from "./action-types";

export type PillMode = "dot" | "menu" | "loading" | "result";
export type ResultKind = "refine" | "keep" | "error";

const DOT_SIZE = 20;
const VIEWPORT_MARGIN = 6;
const CORNER_INSET = 4;
const MENU_GAP = 6;

const MODE_LABEL: Record<PillMode, string> = {
  dot: "Rewrite with Promptizer",
  menu: "Rewrite with Promptizer",
  loading: "Promptizer is working",
  result: "Promptizer suggestion",
};

const STYLE = `
  :host {
    all: initial;
  }
  .pz-root {
    --pz-bg: #ffffff;
    --pz-border: #dedbd5;
    --pz-text: #141413;
    --pz-text-muted: #78716c;
    --pz-shadow: 0 1px 8px rgb(20 20 19 / 0.12), 0 0 2px rgb(20 20 19 / 0.12);
    --pz-shadow-hover: 0 6px 24px rgb(20 20 19 / 0.16), 0 0 2px rgb(20 20 19 / 0.12);
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  }
  @media (prefers-color-scheme: dark) {
    .pz-root {
      --pz-bg: #1b1e24;
      --pz-border: #343a45;
      --pz-text: #e8eaed;
      --pz-text-muted: #9aa0aa;
      --pz-shadow: 0 1px 8px rgb(0 0 0 / 0.4), 0 0 2px rgb(0 0 0 / 0.3);
      --pz-shadow-hover: 0 6px 24px rgb(0 0 0 / 0.5), 0 0 2px rgb(0 0 0 / 0.3);
    }
  }
  .pz-root {
    position: relative;
  }
  .pz-pill {
    all: unset;
    box-sizing: border-box;
    display: flex;
    align-items: center;
    gap: 6px;
    height: ${DOT_SIZE}px;
    min-width: ${DOT_SIZE}px;
    max-width: ${DOT_SIZE}px;
    border-radius: 10px;
    background: var(--pz-bg);
    border: 1px solid transparent;
    box-shadow: var(--pz-shadow);
    color: var(--pz-text);
    padding: 0 3px;
    overflow: hidden;
    cursor: pointer;
    transition: max-width 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease;
  }
  .pz-pill[data-mode="dot"]:hover,
  .pz-pill[data-mode="menu"],
  .pz-pill[data-mode="result"] {
    max-width: 280px;
    border-color: var(--pz-border);
    box-shadow: var(--pz-shadow-hover);
  }
  .pz-pill[data-mode="result"] {
    height: auto;
    max-width: 320px;
    max-height: 320px;
    overflow-y: auto;
    align-items: flex-start;
    flex-wrap: wrap;
    padding: 8px 10px;
    gap: 6px;
  }
  .pz-pill[data-mode="loading"] {
    cursor: default;
    color: #4c8dff;
  }
  .pz-pill[data-mode="loading"] .pz-pill__icon {
    animation: pz-spin 0.8s linear infinite;
  }
  .pz-pill[data-result="refine"] .pz-pill__icon,
  .pz-pill[data-result="keep"] .pz-pill__icon {
    color: #3fcf8e;
  }
  .pz-pill[data-result="error"] .pz-pill__icon {
    color: #ff8a80;
  }
  .pz-pill__icon {
    flex: none;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 14px;
    height: 14px;
  }
  .pz-pill[data-mode="result"] .pz-pill__icon {
    margin-top: 2px;
  }
  .pz-pill__label {
    flex: 1 1 auto;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 12px;
    line-height: 16px;
    text-align: left;
  }
  .pz-pill[data-mode="result"] .pz-pill__label {
    white-space: normal;
    overflow: visible;
    text-overflow: clip;
  }
  .pz-pill__actions {
    flex: none;
    display: flex;
    align-items: center;
    gap: 2px;
  }
  .pz-pill[data-mode="result"] .pz-pill__actions {
    flex-basis: 100%;
    justify-content: flex-end;
  }
  button.pz-pill__button {
    all: unset;
    box-sizing: border-box;
    cursor: pointer;
    font-size: 11px;
    line-height: 14px;
    font-weight: 600;
    white-space: nowrap;
    padding: 3px 8px;
    border-radius: 7px;
  }
  .pz-pill__button--primary {
    background: #4c8dff;
    color: #0b1220;
  }
  .pz-pill__button--icon {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 3px;
    color: var(--pz-text-muted);
  }
  button.pz-pill__button:focus-visible {
    outline: 2px solid #4c8dff;
    outline-offset: 1px;
  }
  .pz-pill__button[hidden] {
    display: none !important;
  }
  .pz-menu {
    position: absolute;
    display: none;
    flex-direction: column;
    min-width: 220px;
    background: var(--pz-bg);
    border: 1px solid var(--pz-border);
    border-radius: 10px;
    box-shadow: var(--pz-shadow-hover);
    padding: 4px;
    gap: 2px;
  }
  .pz-menu[data-open="true"] {
    display: flex;
  }
  .pz-menu__item {
    all: unset;
    box-sizing: border-box;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 7px 8px;
    border-radius: 7px;
    font-size: 12px;
    line-height: 16px;
    color: var(--pz-text);
    cursor: pointer;
  }
  .pz-menu__item:hover,
  .pz-menu__item:focus-visible {
    background: color-mix(in srgb, var(--pz-text) 8%, transparent);
  }
  .pz-menu__item-icon {
    flex: none;
    width: 14px;
    height: 14px;
    color: var(--pz-text-muted);
  }
  .pz-menu__item-text {
    flex: 1 1 auto;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  @media (prefers-reduced-motion: reduce) {
    .pz-pill {
      transition: none;
    }
    .pz-pill[data-mode="loading"] .pz-pill__icon {
      animation: none;
    }
  }
  @keyframes pz-spin {
    to {
      transform: rotate(360deg);
    }
  }
`;

function resultIconFor(kind: ResultKind): string {
  if (kind === "error") {
    return icon("error", 14);
  }
  return icon("check", 14);
}

export class FloatingPill {
  private readonly host: HTMLDivElement;
  private readonly root: HTMLDivElement;
  private readonly pill: HTMLButtonElement;
  private readonly iconSlot: HTMLSpanElement;
  private readonly labelSlot: HTMLSpanElement;
  private readonly actionsSlot: HTMLDivElement;
  private readonly replaceButton: HTMLButtonElement;
  private readonly dismissButton: HTMLButtonElement;
  private readonly menu: HTMLDivElement;
  private mode: PillMode = "dot";
  private visible = false;

  constructor(
    private readonly onSelectAction: (action: ActionId) => void,
    private readonly onReplace: () => void,
    private readonly onDismiss: () => void,
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
    style.textContent = STYLE;

    this.root = document.createElement("div");
    this.root.className = "pz-root";

    this.pill = document.createElement("button");
    this.pill.type = "button";
    this.pill.className = "pz-pill";
    this.pill.addEventListener("mousedown", (event) => event.preventDefault());
    this.pill.addEventListener("click", () => this.handlePillClick());

    this.iconSlot = document.createElement("span");
    this.iconSlot.className = "pz-pill__icon";
    this.iconSlot.innerHTML = icon("sparkle", 14);

    this.labelSlot = document.createElement("span");
    this.labelSlot.className = "pz-pill__label";

    this.actionsSlot = document.createElement("div");
    this.actionsSlot.className = "pz-pill__actions";

    this.dismissButton = document.createElement("button");
    this.dismissButton.type = "button";
    this.dismissButton.className = "pz-pill__button pz-pill__button--icon";
    this.dismissButton.setAttribute("aria-label", "Dismiss");
    this.dismissButton.innerHTML = icon("close", 14);
    this.dismissButton.hidden = true;
    this.dismissButton.addEventListener("mousedown", (event) => event.preventDefault());
    this.dismissButton.addEventListener("click", (event) => {
      event.stopPropagation();
      this.onDismiss();
    });

    this.replaceButton = document.createElement("button");
    this.replaceButton.type = "button";
    this.replaceButton.className = "pz-pill__button pz-pill__button--primary";
    this.replaceButton.textContent = "Replace";
    this.replaceButton.hidden = true;
    this.replaceButton.addEventListener("mousedown", (event) => event.preventDefault());
    this.replaceButton.addEventListener("click", (event) => {
      event.stopPropagation();
      this.onReplace();
    });

    this.actionsSlot.append(this.dismissButton, this.replaceButton);
    this.pill.append(this.iconSlot, this.labelSlot, this.actionsSlot);

    this.menu = document.createElement("div");
    this.menu.className = "pz-menu";
    this.menu.setAttribute("role", "menu");

    this.root.append(this.pill, this.menu);
    shadow.append(style, this.root);

    this.setMode("dot");
  }

  private handlePillClick(): void {
    if (this.mode === "dot") {
      this.setMode("menu");
      return;
    }
    if (this.mode === "menu") {
      this.setMode("dot");
    }
  }

  buildMenu(items: { action: ActionId; label: string; iconName: Parameters<typeof icon>[0] }[]): void {
    this.menu.replaceChildren();
    for (const item of items) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "pz-menu__item";
      button.setAttribute("role", "menuitem");
      const itemIcon = document.createElement("span");
      itemIcon.className = "pz-menu__item-icon";
      itemIcon.innerHTML = icon(item.iconName, 14);
      const itemText = document.createElement("span");
      itemText.className = "pz-menu__item-text";
      itemText.textContent = item.label;
      button.append(itemIcon, itemText);
      button.addEventListener("mousedown", (event) => event.preventDefault());
      button.addEventListener("click", (event) => {
        event.stopPropagation();
        this.setMode("dot");
        this.onSelectAction(item.action);
      });
      this.menu.append(button);
    }
  }

  isMenuOpen(): boolean {
    return this.mode === "menu";
  }

  closeMenu(): void {
    if (this.mode === "menu") {
      this.setMode("dot");
    }
  }

  setMode(mode: PillMode): void {
    this.mode = mode;
    this.pill.dataset.mode = mode;
    this.pill.setAttribute("aria-label", MODE_LABEL[mode]);
    this.menu.dataset.open = String(mode === "menu");
    if (mode === "dot" || mode === "menu") {
      delete this.pill.dataset.result;
      this.iconSlot.innerHTML = icon("sparkle", 14);
      this.labelSlot.textContent = "Rewrite with Promptizer";
      this.replaceButton.hidden = true;
      this.dismissButton.hidden = true;
    } else if (mode === "loading") {
      delete this.pill.dataset.result;
      this.iconSlot.innerHTML = icon("retry", 14);
      this.labelSlot.textContent = "Refining…";
      this.replaceButton.hidden = true;
      this.dismissButton.hidden = true;
    }
    if (mode === "menu") {
      this.positionMenu();
    }
  }

  setResult(kind: ResultKind, label: string): void {
    this.mode = "result";
    this.pill.dataset.mode = "result";
    this.pill.dataset.result = kind;
    this.pill.setAttribute("aria-label", `Promptizer: ${label}`);
    this.iconSlot.innerHTML = resultIconFor(kind);
    this.labelSlot.textContent = label;
    this.replaceButton.hidden = kind !== "refine";
    this.dismissButton.hidden = false;
  }

  mount(): void {
    if (!document.documentElement.contains(this.host)) {
      document.documentElement.append(this.host);
    }
  }

  destroy(): void {
    this.host.remove();
  }

  isClickInside(event: MouseEvent): boolean {
    return event.composedPath().includes(this.host);
  }

  private positionMenu(): void {
    const pillRect = this.pill.getBoundingClientRect();
    this.menu.style.right = "0px";
    this.menu.style.bottom = `${pillRect.height + MENU_GAP}px`;
  }

  positionAtBottomRight(rect: DOMRect): void {
    const rightInset = Math.max(VIEWPORT_MARGIN, window.innerWidth - rect.right + CORNER_INSET);
    const bottomInset = Math.max(VIEWPORT_MARGIN, window.innerHeight - rect.bottom + CORNER_INSET);
    this.host.style.right = `${rightInset}px`;
    this.host.style.bottom = `${bottomInset}px`;
    if (this.mode === "menu") {
      this.positionMenu();
    }
  }

  show(): void {
    this.host.style.display = "block";
    this.visible = true;
  }

  hide(): void {
    this.host.style.display = "none";
    this.visible = false;
    this.setMode("dot");
  }

  isVisible(): boolean {
    return this.visible;
  }
}
