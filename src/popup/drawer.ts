import { browser } from "wxt/browser";
import { el } from "./dom";
import { drawerHeader, drawerItem } from "./components";
import { countEnabledPlatforms } from "./main-view";
import { nanoStatusLabel } from "./state-types";
import type { Dispatch, PopupScreen } from "./types";
import type { IconName } from "../utils/icons";

const HELP_URL = "https://github.com/PhongLee1210/promptizer#use-the-extension";
const PRIVACY_URL = "https://github.com/PhongLee1210/promptizer#privacy";

interface DrawerDestination {
  screen: PopupScreen;
  iconName: IconName;
  label: string;
}

const DESTINATIONS: DrawerDestination[] = [
  { screen: "platforms", iconName: "globe", label: "Platforms" },
  { screen: "models", iconName: "device", label: "Models & keys" },
  { screen: "providers", iconName: "key", label: "Providers & keys" },
  { screen: "suggestions", iconName: "sliders", label: "Suggestions" },
];

function openInTab(url: string): void {
  void browser.tabs.create({ url });
}

export function renderDrawer(dispatch: Dispatch): HTMLElement {
  const state = dispatch.getState();
  const counts = countEnabledPlatforms(state);
  const current = dispatch.getScreen();

  const items = DESTINATIONS.map((destination) =>
    drawerItem({
      iconName: destination.iconName,
      label: destination.label,
      value: destination.screen === "platforms" ? `${counts.enabled}/${counts.total}` : undefined,
      current: destination.screen === current,
      onClick: () => dispatch.goTo(destination.screen),
    }),
  );

  const scrim = el("div", { class: "pz-drawer-backdrop" });
  scrim.addEventListener("click", () => dispatch.closeDrawer());

  const panel = el("div", { class: "pz-drawer", role: "dialog", "aria-modal": "true", "aria-label": "Settings menu" }, [
    drawerHeader({ onClose: () => dispatch.closeDrawer(), onBrandClick: () => dispatch.goTo("main") }),
    el("nav", { class: "pz-drawer__nav" }, [
      ...items,
      el("div", { class: "pz-drawer__divider" }),
      drawerItem({ iconName: "help", label: "Help", external: true, onClick: () => openInTab(HELP_URL) }),
      drawerItem({ iconName: "shield", label: "Privacy", external: true, onClick: () => openInTab(PRIVACY_URL) }),
      drawerItem({
        iconName: "sparkle",
        label: "Setup guide",
        value: nanoStatusLabel(state.nano),
        current: current === "nano-setup",
        onClick: () => dispatch.goTo("nano-setup"),
      }),
    ]),
    el("p", { class: "pz-drawer__version pz-micro pz-text-muted" }, [
      `Promptizer ${browser.runtime.getManifest().version}`,
    ]),
  ]);
  panel.addEventListener("click", (event) => event.stopPropagation());

  return el("div", { class: "pz-drawer-root", "data-open": "false" }, [scrim, panel]);
}
