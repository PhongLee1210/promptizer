import { liveRegion } from "./components";
import { renderDrawer } from "./drawer";
import { getActiveTabHostname, loadPopupState, onPopupStateChanged, readCachedState, savePopupState } from "./storage";
import { defaultPopupState, syncModelOrderStatus, type PopupState } from "./state-types";
import { renderMainScreen } from "./screens/main";
import { renderModelsScreen } from "./screens/models";
import { renderPlatformsScreen } from "./screens/platforms";
import { renderProvidersScreen } from "./screens/providers";
import { renderSuggestionsScreen } from "./screens/suggestions";
import { renderNanoSetupScreen } from "./screens/nano-setup";
import { nanoAvailability, prepareNano, type NanoAvailability } from "../content/nano";
import type { NanoSetupStatus, NanoState } from "./state-types";
import type { Dispatch, PopupScreen } from "./types";

const DRAWER_CLOSE_MS = 180;

const SCREENS: Record<PopupScreen, (dispatch: Dispatch) => HTMLElement> = {
  main: renderMainScreen,
  platforms: renderPlatformsScreen,
  models: renderModelsScreen,
  providers: renderProvidersScreen,
  suggestions: renderSuggestionsScreen,
  "nano-setup": renderNanoSetupScreen,
};

function nanoStatusFor(availability: NanoAvailability): NanoSetupStatus {
  switch (availability) {
    case "available":
      return "ready";
    case "downloading":
      return "downloading";
    case "downloadable":
      return "needs-download";
    default:
      return "unsupported";
  }
}

export async function mountPopup(root: HTMLElement): Promise<void> {
  let state = syncModelOrderStatus(readCachedState() ?? defaultPopupState());
  let activeHostname: string | undefined;
  let screen: PopupScreen = "main";
  let drawerOpen = false;
  let drawerWasOpen = false;
  let drawerCloseTimer: number | undefined;
  let nanoTracking = false;

  async function applyNano(next: NanoState): Promise<void> {
    if (state.nano.status === next.status && state.nano.percent === next.percent) {
      return;
    }
    await dispatch.updateState((current) => ({ ...current, nano: next }));
  }

  // One create() call both starts the download and reports its progress, so the same call
  // covers "begin it" and "follow one already running".
  async function trackNanoDownload(): Promise<void> {
    if (nanoTracking) {
      return;
    }
    nanoTracking = true;
    try {
      const outcome = await prepareNano({
        onProgress: (percent) => void applyNano({ status: "downloading", percent }),
      });
      await applyNano(
        outcome === "available" ? { status: "ready", percent: 100 } : { status: nanoStatusFor(outcome), percent: 0 },
      );
    } finally {
      nanoTracking = false;
    }
  }

  async function refreshNano(): Promise<void> {
    const availability = await nanoAvailability();
    if (availability === "downloading") {
      await applyNano({ status: "downloading", percent: state.nano.percent });
      void trackNanoDownload();
      return;
    }
    await applyNano({ status: nanoStatusFor(availability), percent: availability === "available" ? 100 : 0 });
  }

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
    refreshNano,
    startNanoDownload: trackNanoDownload,
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

  await refreshNano();

  onPopupStateChanged((next: PopupState) => {
    state = syncModelOrderStatus(next);
    render();
  });

  if (screen === "main" && !drawerOpen) {
    screenHost.querySelector<HTMLElement>(".pz-power-button")?.focus();
  }
}
