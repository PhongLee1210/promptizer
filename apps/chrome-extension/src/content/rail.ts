import { icon, type IconName } from "../utils/icons";
import { ACTION_COPY, OFFLINE_SAVE_MESSAGE } from "./present-result";
import type { ActionId, RailGroupId } from "./action-types";
import type { ChipView } from "./chip-state";

export interface RailCallbacks {
  onSelectLeaf: (action: ActionId) => void;
  onToggleGroup: (group: RailGroupId) => void;
  onRecentOpened: () => void;
  onSavePromptOpened: () => void;
  onMyPromptsOpened: () => void;
  onTurnOff: () => void;
}

interface RailFace {
  iconName?: IconName;
  text?: string;
}

const FACE: Record<ActionId, RailFace> = {
  refine: { iconName: "wand" },
  improve: { iconName: "wand" },
  grammar: { iconName: "grammar" },
  shorten: { iconName: "shorten" },
  vi: { text: "VI" },
  en: { text: "EN" },
  pro: { iconName: "pro" },
  friendly: { iconName: "friendly" },
  direct: { iconName: "direct" },
};

const GROUP_LEAVES: Record<RailGroupId, ActionId[]> = {
  translate: ["vi", "en"],
  tone: ["pro", "friendly", "direct"],
};

const GROUP_FACE: Record<RailGroupId, IconName> = { translate: "globe", tone: "tone" };
const GROUP_LABEL: Record<RailGroupId, string> = { translate: "Translate", tone: "Change tone" };

const MENU_FOCUS_STEP: Record<string, number | "first" | "last" | undefined> = {
  ArrowDown: 1,
  ArrowUp: -1,
  Home: "first",
  End: "last",
};

export const RAIL_STYLE = `
  .pz-rail {
    position: fixed;
    display: none;
    flex-direction: column-reverse;
    align-items: center;
    gap: 2px;
    width: 28px;
    border-radius: 14px;
    background: var(--pz-color-background-base-floating);
    border: 1px solid var(--pz-color-border-base-floating);
    box-shadow: var(--pz-elevation-base-medium);
    padding: 0;
  }
  .pz-rail[data-open="true"] {
    display: flex;
    animation: pz-rail-pop 140ms ease-out;
  }
  @keyframes pz-rail-pop {
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
    .pz-rail[data-open="true"] {
      animation: none;
    }
  }
  .pz-rail__item {
    position: relative;
    display: flex;
  }
  button.pz-rail__btn {
    all: unset;
    box-sizing: border-box;
    width: 26px;
    height: 26px;
    border-radius: 13px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.04em;
    color: var(--pz-color-text-base-default);
    cursor: pointer;
  }
  button.pz-rail__btn[aria-expanded="true"] {
    background: var(--pz-color-fill-selected-default);
  }
  button.pz-rail__btn:focus-visible {
    outline: none;
  }
  button.pz-rail__btn[aria-disabled="true"] {
    opacity: 0.4;
    cursor: default;
  }
  .pz-rail__strip {
    position: absolute;
    right: 33px;
    top: -1px;
    display: flex;
    gap: 2px;
    border-radius: 14px;
    background: var(--pz-color-background-base-floating);
    border: 1px solid var(--pz-color-border-base-floating);
    box-shadow: var(--pz-elevation-base-medium);
  }
  .pz-rail [data-tip]::after {
    content: attr(data-tip);
    position: absolute;
    right: calc(100% + 10px);
    top: 50%;
    transform: translateY(-50%);
    padding: 5px 8px;
    border-radius: 6px;
    background: var(--pz-color-background-tooltip-default);
    border: 1px solid var(--pz-color-border-base-floating);
    color: var(--pz-color-text-base-default);
    font-size: 11px;
    font-weight: 500;
    white-space: nowrap;
    opacity: 0;
    pointer-events: none;
    z-index: 5;
  }
  .pz-rail [data-tip]:focus-visible::after {
    opacity: 1;
  }
  .pz-rail [aria-expanded="true"][data-tip]::after {
    display: none;
  }
  @media (hover: hover) and (pointer: fine) {
    button.pz-rail__btn:hover {
      background: var(--pz-color-fill-hover-default);
    }
    .pz-rail [data-tip]:hover::after {
      opacity: 1;
    }
  }
`;

function createButton(
  face: RailFace,
  label: string,
  onActivate: () => void,
  extra: { group?: RailGroupId; expanded?: boolean } = {},
): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "pz-rail__btn";
  button.setAttribute("role", "menuitem");
  button.setAttribute("aria-label", label);
  button.dataset.tip = label;
  if (extra.group !== undefined) {
    button.setAttribute("aria-haspopup", "menu");
    button.setAttribute("aria-expanded", String(extra.expanded === true));
  }
  button.innerHTML = face.iconName !== undefined ? icon(face.iconName, 14) : (face.text ?? "");
  button.tabIndex = -1;
  button.addEventListener("mousedown", (event) => event.preventDefault());
  button.addEventListener("click", (event) => {
    event.stopPropagation();
    onActivate();
  });
  return button;
}

function applySavePromptAvailability(button: HTMLButtonElement, online: boolean): void {
  if (online) {
    button.removeAttribute("aria-disabled");
    button.removeAttribute("aria-description");
    button.dataset.tip = "Save prompt";
    return;
  }
  button.setAttribute("aria-disabled", "true");
  button.setAttribute("aria-description", OFFLINE_SAVE_MESSAGE);
  button.dataset.tip = OFFLINE_SAVE_MESSAGE;
}

export class ActionRail {
  private readonly element: HTMLDivElement;

  constructor(private readonly callbacks: RailCallbacks) {
    this.element = document.createElement("div");
    this.element.className = "pz-rail";
    this.element.setAttribute("role", "menu");
    this.element.setAttribute("aria-label", "Promptizer actions");
    this.element.dataset.open = "false";
    this.element.addEventListener("keydown", (event) => this.moveFocus(event));
  }

  node(): HTMLDivElement {
    return this.element;
  }

  render(view: ChipView, context: "chat" | "editor", hasHistory: boolean, signedIn: boolean, online: boolean): void {
    const open = view.kind === "rail";
    this.element.dataset.open = String(open);
    this.element.replaceChildren();
    if (!open) {
      return;
    }
    const openGroup = view.openGroup;

    const leaf = context === "editor" ? "improve" : "refine";
    this.appendLeaf(leaf);
    this.appendLeaf("grammar");
    this.appendLeaf("shorten");
    this.appendGroup("translate", openGroup === "translate");
    this.appendGroup("tone", openGroup === "tone");
    if (signedIn) {
      this.appendSavePrompt(online);
      this.appendMyPrompts();
    }
    if (hasHistory) {
      this.appendRecent();
    }
    this.appendTurnOff();
    const topLevelItems = this.topLevelItems();
    topLevelItems[0]?.setAttribute("tabindex", "0");
  }

  focusFirstItem(): void {
    this.topLevelItems()[0]?.focus();
  }

  private topLevelItems(): HTMLButtonElement[] {
    return [...this.element.querySelectorAll<HTMLButtonElement>('[role="menuitem"]')].filter(
      (node) => node.closest(".pz-rail__strip") === null,
    );
  }

  groupItemRect(group: RailGroupId): DOMRect | null {
    const button = this.element.querySelector<HTMLButtonElement>(`[data-group="${group}"]`);
    return button?.getBoundingClientRect() ?? null;
  }

  private appendLeaf(action: ActionId): void {
    const item = document.createElement("span");
    item.className = "pz-rail__item";
    item.append(createButton(FACE[action], ACTION_COPY[action].label, () => this.callbacks.onSelectLeaf(action)));
    this.element.append(item);
  }

  private appendGroup(group: RailGroupId, isOpen: boolean): void {
    const item = document.createElement("span");
    item.className = "pz-rail__item";
    const groupButton = createButton(
      { iconName: GROUP_FACE[group] },
      GROUP_LABEL[group],
      () => this.callbacks.onToggleGroup(group),
      { group, expanded: isOpen },
    );
    groupButton.dataset.group = group;
    item.append(groupButton);
    if (isOpen) {
      const strip = document.createElement("span");
      strip.className = "pz-rail__strip";
      strip.setAttribute("role", "menu");
      strip.setAttribute("aria-label", GROUP_LABEL[group]);
      for (const leaf of GROUP_LEAVES[group]) {
        strip.append(createButton(FACE[leaf], ACTION_COPY[leaf].label, () => this.callbacks.onSelectLeaf(leaf)));
      }
      item.append(strip);
    }
    this.element.append(item);
  }

  private appendRecent(): void {
    const item = document.createElement("span");
    item.className = "pz-rail__item";
    item.append(createButton({ iconName: "clock" }, "Recent results", () => this.callbacks.onRecentOpened()));
    this.element.append(item);
  }

  private appendSavePrompt(online: boolean): void {
    const item = document.createElement("span");
    item.className = "pz-rail__item";
    const button = createButton({ iconName: "cloud" }, "Save prompt", () => {
      if (button.getAttribute("aria-disabled") !== "true") {
        this.callbacks.onSavePromptOpened();
      }
    });
    button.dataset.railItem = "save-prompt";
    applySavePromptAvailability(button, online);
    item.append(button);
    this.element.append(item);
  }

  syncSavePromptAvailability(online: boolean): void {
    const button = this.element.querySelector<HTMLButtonElement>('[data-rail-item="save-prompt"]');
    if (button !== null) {
      applySavePromptAvailability(button, online);
    }
  }

  private appendMyPrompts(): void {
    const item = document.createElement("span");
    item.className = "pz-rail__item";
    item.append(createButton({ iconName: "menu" }, "My Prompts", () => this.callbacks.onMyPromptsOpened()));
    this.element.append(item);
  }

  private appendTurnOff(): void {
    const item = document.createElement("span");
    item.className = "pz-rail__item";
    item.append(createButton({ iconName: "power" }, "Turn off", () => this.callbacks.onTurnOff()));
    this.element.append(item);
  }

  private moveFocus(event: KeyboardEvent): void {
    const step = MENU_FOCUS_STEP[event.key];
    if (step === undefined) {
      return;
    }
    const items = this.topLevelItems();
    const current = items.indexOf(event.target as HTMLButtonElement);
    const target = step === "first" ? 0 : step === "last" ? items.length - 1 : current + step;
    const next = items[(target + items.length) % items.length];
    if (next === undefined) {
      return;
    }
    event.preventDefault();
    for (const item of items) {
      item.tabIndex = item === next ? 0 : -1;
    }
    next.focus();
  }
}
