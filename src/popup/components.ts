import { browser } from "wxt/browser";
import { el, iconEl } from "./dom";
import type { IconName } from "../utils/icons";

function brandLogo(): HTMLImageElement {
  return el("img", { class: "pz-brand-logo", alt: "", src: browser.runtime.getURL("/icon/32.png") });
}

function isDisabled(node: HTMLElement): boolean {
  return node.getAttribute("aria-disabled") === "true";
}

export type StatusDotKind = "ready" | "standing-by" | "warning" | "error";

export function statusDot(kind: StatusDotKind): HTMLSpanElement {
  return el("span", { class: `pz-status-dot pz-status-dot--${kind}` });
}

export function statusPill(label: string, kind: StatusDotKind, pillIcon?: IconName): HTMLSpanElement {
  const children: Node[] = [];
  if (pillIcon !== undefined) {
    children.push(iconEl(pillIcon, 14));
  } else {
    children.push(statusDot(kind));
  }
  children.push(el("span", {}, [label]));
  return el("span", { class: `pz-pill pz-pill--${kind}`, role: "status" }, children);
}

export function iconButton(options: {
  iconName: IconName;
  label: string;
  size?: number;
  extraClass?: string;
  iconClass?: string;
  disabled?: boolean;
  onClick: () => void;
}): HTMLButtonElement {
  const glyph = iconEl(options.iconName, options.size ?? 20);
  if (options.iconClass !== undefined) {
    glyph.setAttribute("class", options.iconClass);
  }
  const node = el(
    "button",
    {
      class: ["pz-icon-button", "pz-control", options.extraClass ?? ""].filter(Boolean).join(" "),
      "aria-label": options.label,
      "aria-disabled": options.disabled === true ? "true" : undefined,
    },
    [glyph],
  );
  node.addEventListener("click", () => {
    if (isDisabled(node)) {
      return;
    }
    options.onClick();
  });
  return node;
}

export function toggle(options: {
  id: string;
  checked: boolean;
  disabled?: boolean;
  label: string;
  onChange: (checked: boolean) => void;
}): HTMLButtonElement {
  const button = el(
    "button",
    {
      id: options.id,
      role: "switch",
      "aria-checked": String(options.checked),
      "aria-label": options.label,
      class: "pz-toggle pz-control",
      "aria-disabled": options.disabled === true ? "true" : undefined,
    },
    [el("span", { class: "pz-toggle__knob" })],
  );
  button.addEventListener("click", () => {
    if (isDisabled(button)) {
      return;
    }
    const next = button.getAttribute("aria-checked") !== "true";
    button.setAttribute("aria-checked", String(next));
    options.onChange(next);
  });
  return button;
}

export function button(options: {
  label: string;
  variant?: "primary" | "outline" | "text" | "dashed";
  iconName?: IconName;
  disabled?: boolean;
  onClick?: () => void;
}): HTMLButtonElement {
  const variant = options.variant ?? "primary";
  const children: (Node | string)[] = [];
  if (options.iconName !== undefined) {
    children.push(iconEl(options.iconName, 16));
  }
  children.push(options.label);
  const node = el(
    "button",
    {
      class: `pz-button pz-button--${variant} pz-control${variant === "primary" ? " pz-control--filled" : ""}`,
      "aria-disabled": options.disabled === true ? "true" : undefined,
    },
    children,
  );
  const onClick = options.onClick;
  if (onClick !== undefined) {
    node.addEventListener("click", () => {
      if (isDisabled(node)) {
        return;
      }
      onClick();
    });
  }
  return node;
}

export function navRow(options: { label: string; value: string; onClick: () => void }): HTMLButtonElement {
  const node = el("button", { class: "pz-nav-row pz-control" }, [
    el("span", { class: "pz-nav-row__label pz-body" }, [options.label]),
    el("span", { class: "pz-nav-row__value pz-caption" }, [options.value]),
    iconEl("chevron-right", 18),
  ]);
  node.addEventListener("click", options.onClick);
  return node;
}

export function settingRow(options: { label: string; sublabel?: string; control: HTMLElement }): HTMLDivElement {
  const labelChildren: (Node | string)[] = [el("span", { class: "pz-body" }, [options.label])];
  if (options.sublabel !== undefined) {
    labelChildren.push(el("span", { class: "pz-caption pz-text-muted" }, [options.sublabel]));
  }
  return el("div", { class: "pz-setting-row" }, [
    el("div", { class: "pz-setting-row__label" }, labelChildren),
    options.control,
  ]);
}

export function banner(options: {
  kind: "warning" | "danger" | "info";
  text: string;
  action?: HTMLElement;
}): HTMLDivElement {
  const children: (Node | string)[] = [
    iconEl(options.kind === "danger" ? "error" : options.kind === "warning" ? "warning" : "info", 18),
    el("span", { class: "pz-body" }, [options.text]),
  ];
  if (options.action !== undefined) {
    children.push(options.action);
  }
  return el(
    "div",
    { class: `pz-banner pz-banner--${options.kind}`, role: options.kind === "danger" ? "alert" : "status" },
    children,
  );
}

export function footerNote(text: string): HTMLParagraphElement {
  return el("p", { class: "pz-footer-note pz-micro" }, [text]);
}

export function liveRegion(): HTMLDivElement {
  return el("div", { class: "pz-visually-hidden", "aria-live": "polite", id: "pz-live-region" });
}

function menuButton(options: { drawerOpen: boolean; onMenuClick: () => void }): HTMLButtonElement {
  const node = iconButton({
    iconName: "menu",
    label: "Settings menu",
    extraClass: "pz-menu-button",
    onClick: options.onMenuClick,
  });
  node.setAttribute("aria-expanded", String(options.drawerOpen));
  return node;
}

export function headerMain(options: {
  statusPillNode: HTMLElement;
  drawerOpen: boolean;
  onMenuClick: () => void;
}): HTMLDivElement {
  return el("div", { class: "pz-header-main" }, [
    menuButton(options),
    el("div", { class: "pz-header-main__brand" }, [brandLogo(), el("h1", { class: "pz-header" }, ["Promptizer"])]),
    options.statusPillNode,
  ]);
}

export function headerSub(options: {
  title: string;
  count?: string;
  drawerOpen: boolean;
  onMenuClick: () => void;
}): HTMLDivElement {
  const children: (Node | string)[] = [menuButton(options), el("h1", { class: "pz-header" }, [options.title])];
  if (options.count !== undefined) {
    children.push(el("span", { class: "pz-caption pz-text-muted pz-header-sub__trailing" }, [options.count]));
  }
  return el("div", { class: "pz-header-sub" }, children);
}

export function drawerItem(options: {
  iconName: IconName;
  label: string;
  value?: string;
  current?: boolean;
  external?: boolean;
  onClick: () => void;
}): HTMLButtonElement {
  const children: (Node | string)[] = [
    iconEl(options.iconName, 20),
    el("span", { class: "pz-drawer-item__label pz-body" }, [options.label]),
  ];
  if (options.value !== undefined) {
    children.push(el("span", { class: "pz-caption pz-text-muted" }, [options.value]));
  }
  if (options.external === true) {
    children.push(iconEl("arrow-right", 16));
  }
  const node = el(
    "button",
    {
      class: "pz-drawer-item pz-control",
      "aria-current": options.current === true ? "page" : undefined,
    },
    children,
  );
  node.addEventListener("click", options.onClick);
  return node;
}

export function cardLink(options: {
  label: string;
  onClick: () => void;
  children: (Node | string)[];
}): HTMLButtonElement {
  const node = el("button", { class: "pz-card pz-card--link pz-control", "aria-label": options.label }, [
    el("div", { class: "pz-card__head" }, [
      el("p", { class: "pz-overline pz-text-muted" }, [options.label]),
      iconEl("chevron-right", 18),
    ]),
    ...options.children,
  ]);
  node.addEventListener("click", options.onClick);
  return node;
}

export function screenShell(header: HTMLElement, body: (Node | string)[], modifier?: string): HTMLDivElement {
  return el("div", { class: `pz-screen${modifier === undefined ? "" : ` pz-screen--${modifier}`}` }, [
    header,
    el("div", { class: "pz-screen__body" }, body),
  ]);
}

export function sectionHeading(title: string, caption?: string): HTMLDivElement {
  const children: (Node | string)[] = [el("p", { class: "pz-overline pz-text-muted" }, [title])];
  if (caption !== undefined) {
    children.push(el("p", { class: "pz-caption pz-text-muted" }, [caption]));
  }
  return el("div", { class: "pz-section-heading" }, children);
}

export function drawerHeader(options: { onClose: () => void; onBrandClick: () => void }): HTMLDivElement {
  const brand = el("button", { class: "pz-drawer__brand pz-control" }, [
    el("span", { class: "pz-header" }, ["Promptizer"]),
  ]);
  brand.addEventListener("click", options.onBrandClick);
  return el("div", { class: "pz-header-sub" }, [
    iconButton({
      iconName: "close",
      label: "Close settings menu",
      extraClass: "pz-drawer__close",
      onClick: options.onClose,
    }),
    brand,
  ]);
}

export function emptyState(options: { illustration: string; text: string; action: HTMLElement }): HTMLDivElement {
  return el("div", { class: "pz-empty-state" }, [
    el("div", { class: "pz-empty-state__illustration", "aria-hidden": "true" }, [options.illustration]),
    el("p", { class: "pz-body" }, [options.text]),
    options.action,
  ]);
}

export function powerButton(options: {
  on: boolean;
  compact?: boolean;
  disabled?: boolean;
  onClick: () => void;
}): HTMLButtonElement {
  const node = el(
    "button",
    {
      class: [
        "pz-power-button",
        "pz-control",
        options.on ? "pz-power-button--on" : "pz-power-button--off",
        options.compact === true ? "pz-power-button--compact" : "",
      ]
        .filter(Boolean)
        .join(" "),
      "aria-pressed": String(options.on),
      "aria-label": options.on ? "Turn suggestions off" : "Turn suggestions on",
      "aria-disabled": options.disabled === true ? "true" : undefined,
    },
    [
      iconEl("power", options.compact === true ? 26 : 30),
      el("span", { class: "pz-caption" }, [options.on ? "On" : "Off"]),
    ],
  );
  node.addEventListener("click", () => {
    if (isDisabled(node)) {
      return;
    }
    options.onClick();
  });
  return node;
}
