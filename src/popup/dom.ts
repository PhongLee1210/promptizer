import { icon, type IconName } from "../utils/icons";

type Attrs = Record<string, string | undefined>;

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Attrs = {},
  children: (Node | string)[] = [],
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value === undefined) {
      continue;
    }
    if (key === "class") {
      node.className = value;
    } else {
      node.setAttribute(key, value);
    }
  }
  for (const child of children) {
    node.append(typeof child === "string" ? document.createTextNode(child) : child);
  }
  return node;
}

export function iconEl(name: IconName, size = 24): SVGElement {
  const wrapper = document.createElement("span");
  wrapper.innerHTML = icon(name, size);
  const svg = wrapper.firstElementChild as SVGElement;
  return svg;
}
