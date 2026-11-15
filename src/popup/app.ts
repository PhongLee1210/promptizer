import { liveRegion } from "./components";
import { renderDrawer } from "./drawer";
import { getActiveTabHostname, loadPopupState, onPopupStateChanged, readCachedState, savePopupState } from "./storage";
import { defaultPopupState, syncModelOrderStatus, type PopupState } from "./state-types";
import { renderMainScreen } from "./screens/main";
import { renderModelsScreen } from "./screens/models";
import { renderPlatformsScreen } from "./screens/platforms";
import { renderProvidersScreen } from "./screens/providers";
import { renderSuggestionsScreen } from "./screens/suggestions";
import type { Dispatch, PopupScreen } from "./types";

const DRAWER_CLOSE_MS = 180;

const SCREENS: Record<PopupScreen, (dispatch: Dispatch) => HTMLElement> = {
  main: renderMainScreen,
  platforms: renderPlatformsScreen,
  models: renderModelsScreen,
  providers: renderProvidersScreen,
  suggestions: renderSuggestionsScreen,
};

export async function mountPopup(root: HTMLElement): Promise<void> {
  let state = syncModelOrderStatus(readCachedState() ?? defaultPopupState());
  let activeHostname: string | undefined;
  let screen: PopupScreen = "main";
  let drawerOpen = false;
  let drawerWasOpen = false;
  let drawerCloseTimer: number | undefined;

  const live = liveRegion();
  const screenHost = document.createElement("div");
  const drawerHost = document.createElement("div");
  drawerHost.hidden = true;
  root.append(live, screenHost, drawerHost);

  const dispatch: Dispatch = {
    getState() {
      return state;
    },
    getActiveHostname() {
      return activeHostname;
    },
    getScreen() {
      return screen;
    },
    isDrawerOpen() {
      return drawerOpen;
    },
    async updateState(mutator) {
      state = syncModelOrderStatus(mutator(state));
      await savePopupState(state);
      render();
    },
    announce(message) {
      live.textContent = "";
      requestAnimationFrame(() => {
        live.textContent = message;
      });
    },
    rerender() {
      render();
    },
    openDrawer() {
      drawerOpen = true;
      render();
    },
    closeDrawer() {
      drawerOpen = false;
      render();
    },
    goTo(next) {
      screen = next;
      drawerOpen = false;
      render();
    },
  };

  document.addEventListener("keydown", (event: KeyboardEvent) => {
    if (event.key === "Escape" && drawerOpen) {
      event.preventDefault();
      dispatch.closeDrawer();
    }
  });

  function openDrawerPanel(): void {
    if (drawerCloseTimer !== undefined) {
      window.clearTimeout(drawerCloseTimer);
      drawerCloseTimer = undefined;
    }
    drawerHost.hidden = false;
    const isFirstOpen = !drawerWasOpen;
    drawerHost.replaceChildren(renderDrawer(dispatch));
    const panel = drawerHost.firstElementChild as HTMLElement;
    if (isFirstOpen) {
      panel.setAttribute("data-open", "false");
      requestAnimationFrame(() => {
        requestAnimationFrame(() => panel.setAttribute("data-open", "true"));
      });
      panel.querySelector<HTMLElement>(".pz-drawer-item")?.focus();
    } else {
      panel.setAttribute("data-open", "true");
    }
  }

  function closeDrawerPanel(): void {
    const panel = drawerHost.firstElementChild as HTMLElement | null;
    panel?.setAttribute("data-open", "false");
    drawerCloseTimer = window.setTimeout(() => {
      drawerHost.replaceChildren();
      drawerHost.hidden = true;
      drawerCloseTimer = undefined;
    }, DRAWER_CLOSE_MS);
    screenHost.querySelector<HTMLElement>(".pz-menu-button")?.focus();
  }

  function render(): void {
    screenHost.replaceChildren(SCREENS[screen](dispatch));
    screenHost.inert = drawerOpen;

    if (drawerOpen) {
      openDrawerPanel();
    } else if (drawerWasOpen) {
      closeDrawerPanel();
    }
    drawerWasOpen = drawerOpen;
  }

  render();

  state = syncModelOrderStatus(await loadPopupState());
  activeHostname = await getActiveTabHostname();
  render();

  onPopupStateChanged((next: PopupState) => {
    state = syncModelOrderStatus(next);
    render();
  });

  if (screen === "main" && !drawerOpen) {
    screenHost.querySelector<HTMLElement>(".pz-power-button")?.focus();
  }
}
