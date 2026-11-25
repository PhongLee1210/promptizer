import { browser } from "wxt/browser";
import { el, iconEl } from "./dom";
import { brandLogo, navItem } from "./components";
import { nanoStatusLabel } from "./state-types";
import type { Dispatch, PopupScreen } from "./types";
import type { IconName } from "../utils/icons";

const HELP_URL = "https://github.com/PhongLee1210/promptizer#use-the-extension";
const PRIVACY_URL = "https://github.com/PhongLee1210/promptizer#privacy";

interface ScreenDestination {
  screen: PopupScreen;
  iconName: IconName;
  label: string;
}

const SETTINGS_DESTINATIONS: ScreenDestination[] = [
  { screen: "platforms", iconName: "globe", label: "Platforms" },
  { screen: "models", iconName: "device", label: "Models & keys" },
  { screen: "providers", iconName: "key", label: "Providers & keys" },
  { screen: "suggestions", iconName: "sliders", label: "Suggestions" },
  { screen: "account", iconName: "friendly", label: "Account" },
];

function openInTab(url: string): void {
  void browser.tabs.create({ url });
}

function screenItem(dispatch: Dispatch, destination: ScreenDestination, label = destination.label): HTMLButtonElement {
  const item = navItem({
    iconNode: iconEl(destination.iconName, 24),
    label,
    current: dispatch.getScreen() === destination.screen,
    onClick: () => dispatch.goTo(destination.screen),
  });
  item.dataset.navTarget = destination.screen;
  return item;
}

export function renderNavRail(dispatch: Dispatch): HTMLElement {
  const homeItem = navItem({
    iconNode: brandLogo(),
    label: "Promptizer home",
    current: dispatch.getScreen() === "main",
    onClick: () => dispatch.goTo("main"),
  });
  homeItem.dataset.navTarget = "main";

  const setupItem = screenItem(
    dispatch,
    { screen: "nano-setup", iconName: "sparkle", label: "Setup guide" },
    `Setup guide, ${nanoStatusLabel(dispatch.getState().nano)}`,
  );

  return el("nav", { class: "pz-nav-rail", "aria-label": "Promptizer sections" }, [
    el("div", { class: "pz-nav-rail__list" }, [
      homeItem,
      ...SETTINGS_DESTINATIONS.map((destination) => screenItem(dispatch, destination)),
    ]),
    el("div", { class: "pz-nav-rail__list" }, [
      setupItem,
      navItem({ iconNode: iconEl("help", 24), label: "Help", onClick: () => openInTab(HELP_URL) }),
      navItem({ iconNode: iconEl("shield", 24), label: "Privacy", onClick: () => openInTab(PRIVACY_URL) }),
    ]),
  ]);
}
