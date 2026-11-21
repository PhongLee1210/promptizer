import { browser } from "wxt/browser";
import { el, iconEl } from "./dom";
import type { IconName } from "../utils/icons";

export function brandLogo(): HTMLImageElement {
  return el("img", { class: "pz-brand-logo", alt: "", src: browser.runtime.getURL("/icon/32.png") });
}

function isDisabled(node: HTMLElement): boolean {
  return node.getAttribute("aria-disabled") === "true";
}

function isBusy(node: HTMLElement): boolean {
  return node.getAttribute("aria-busy") === "true";
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
  variant?: "primary" | "outline" | "text" | "dashed" | "danger";
  iconName?: IconName;
  compact?: boolean;
  disabled?: boolean;
  onClick?: () => void;
}): HTMLButtonElement {
  const variant = options.variant ?? "primary";
  const children: (Node | string)[] = [];
  if (options.iconName !== undefined) {
    children.push(iconEl(options.iconName, 16));
  }
  children.push(
    el("span", { class: "pz-button__label" }, [options.label]),
    el("span", { class: "pz-button__spinner", "aria-hidden": "true" }),
  );
  const node = el(
    "button",
    {
      class: [
        "pz-button",
        `pz-button--${variant}`,
        "pz-control",
        variant === "primary" ? "pz-control--filled" : "",
        options.compact === true ? "pz-button--compact" : "",
      ]
        .filter(Boolean)
        .join(" "),
      "aria-disabled": options.disabled === true ? "true" : undefined,
    },
    children,
  );
  const onClick = options.onClick;
  if (onClick !== undefined) {
    node.addEventListener("click", () => {
      if (isDisabled(node) || isBusy(node)) {
        return;
      }
      onClick();
    });
  }
  return node;
}

export function setButtonBusy(node: HTMLButtonElement, busy: boolean): void {
  if (busy) {
    node.setAttribute("aria-busy", "true");
  } else {
    node.removeAttribute("aria-busy");
  }
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
  return el("div", { class: `pz-setting-row${options.sublabel === undefined ? " pz-setting-row--single" : ""}` }, [
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

export function headerMain(options: { statusPillNode: HTMLElement; siteLabel?: string }): HTMLDivElement {
  const children: Node[] = [options.statusPillNode];
  if (options.siteLabel !== undefined) {
    children.push(
      el("span", { class: "pz-pill pz-header-main__site" }, [iconEl("globe", 14), el("span", {}, [options.siteLabel])]),
    );
  }
  return el("div", { class: "pz-header-main" }, children);
}

export function headerSub(options: { title: string; count?: string; action?: HTMLElement }): HTMLDivElement {
  const children: (Node | string)[] = [el("h1", { class: "pz-header" }, [options.title])];
  const trailing: Node[] = [];
  if (options.count !== undefined) {
    trailing.push(el("span", { class: "pz-caption pz-text-muted" }, [options.count]));
  }
  if (options.action !== undefined) {
    trailing.push(options.action);
  }
  if (trailing.length > 0) {
    children.push(el("div", { class: "pz-header-sub__trailing" }, trailing));
  }
  return el("div", { class: "pz-header-sub" }, children);
}

export function navItem(options: {
  iconNode: Element;
  label: string;
  current?: boolean;
  onClick: () => void;
}): HTMLButtonElement {
  const node = el(
    "button",
    {
      class: "pz-nav-item pz-control",
      "aria-label": options.label,
      title: options.label,
      "aria-current": options.current === true ? "page" : undefined,
    },
    [options.iconNode],
  );
  node.addEventListener("click", options.onClick);
  return node;
}

export function regionCard(options: {
  iconName: IconName;
  title: string;
  caption: (Node | string)[];
  label: string;
  onClick: () => void;
  footer?: (Node | string)[];
}): HTMLDivElement {
  const main = el("button", { class: "pz-region-card__main pz-control", "aria-label": options.label }, [
    el("span", { class: "pz-region-card__icon", "aria-hidden": "true" }, [iconEl(options.iconName, 20)]),
    el("span", { class: "pz-region-card__info" }, [
      el("span", { class: "pz-body-strong" }, [options.title]),
      el("span", { class: "pz-caption pz-text-muted" }, options.caption),
    ]),
    el("span", { class: "pz-region-card__chevron" }, [iconEl("chevron-right", 20)]),
  ]);
  main.addEventListener("click", options.onClick);
  const children: Node[] = [main];
  if (options.footer !== undefined && options.footer.length > 0) {
    children.push(
      el("hr", { class: "pz-region-card__divider" }),
      el("div", { class: "pz-region-card__footer" }, options.footer),
    );
  }
  return el("div", { class: "pz-region-card" }, children);
}

export function screenShell(header: HTMLElement, body: (Node | string)[], modifier?: string): HTMLDivElement {
  return el("div", { class: `pz-screen${modifier === undefined ? "" : ` pz-screen--${modifier}`}` }, [
    header,
    el("div", { class: "pz-screen__body" }, body),
  ]);
}

export function sectionHeading(title: string, caption?: string, trailing?: HTMLElement): HTMLDivElement {
  const titleRow: Node[] = [el("p", { class: "pz-overline pz-text-muted" }, [title])];
  if (trailing !== undefined) {
    titleRow.push(trailing);
  }
  const children: Node[] = [el("div", { class: "pz-section-heading__row" }, titleRow)];
  if (caption !== undefined) {
    children.push(el("p", { class: "pz-caption pz-text-muted" }, [caption]));
  }
  return el("div", { class: "pz-section-heading" }, children);
}

export function settingsGroup(heading: HTMLElement, rows: HTMLElement[]): HTMLDivElement {
  return el("div", { class: "pz-group" }, [heading, el("div", { class: "pz-list" }, rows)]);
}

export type PowerStep = "off" | "busy" | "on";

const SVG_NAMESPACE = "http://www.w3.org/2000/svg";
const POWER_ART_VIEWBOX = 200;
const POWER_ART_CENTER = POWER_ART_VIEWBOX / 2;
const POWER_RING_RADIUS = 74;
const POWER_RIPPLE_RADIUS = 68;

function svgCircle(className: string, radius: number): SVGCircleElement {
  const circle = document.createElementNS(SVG_NAMESPACE, "circle");
  circle.setAttribute("class", className);
  circle.setAttribute("cx", String(POWER_ART_CENTER));
  circle.setAttribute("cy", String(POWER_ART_CENTER));
  circle.setAttribute("r", String(radius));
  circle.setAttribute("pathLength", "100");
  return circle;
}

function powerArt(step: PowerStep): SVGSVGElement {
  const art = document.createElementNS(SVG_NAMESPACE, "svg");
  art.setAttribute("class", "pz-power-art");
  art.setAttribute("viewBox", `0 0 ${POWER_ART_VIEWBOX} ${POWER_ART_VIEWBOX}`);
  art.setAttribute("aria-hidden", "true");
  art.setAttribute("data-step", step);
  art.append(
    svgCircle("pz-power-art__ripple", POWER_RIPPLE_RADIUS),
    svgCircle("pz-power-art__ring", POWER_RING_RADIUS),
    svgCircle("pz-power-art__arc", POWER_RING_RADIUS),
  );
  return art;
}

export function powerButton(options: {
  on: boolean;
  step: PowerStep;
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
      powerArt(options.step),
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
