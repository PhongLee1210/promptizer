import { el } from "./dom";
import { liveRegion } from "./components";
import { renderNavRail } from "./nav-rail";
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

function focusedNavTarget(): string | undefined {
  const active = document.activeElement;
  return active instanceof HTMLElement
    ? active.closest<HTMLElement>("[data-nav-target]")?.dataset.navTarget
    : undefined;
}

export async function mountPopup(root: HTMLElement): Promise<void> {
  let state = syncModelOrderStatus(readCachedState() ?? defaultPopupState());
  let activeHostname: string | undefined;
  let screen: PopupScreen = "main";
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
  const railHost = el("div", { class: "pz-nav-layout__rail" });
  const screenHost = el("div", { class: "pz-nav-layout__content" });
  root.append(live, el("div", { class: "pz-nav-layout" }, [railHost, screenHost]));

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
    goTo(next) {
      screen = next;
      render();
    },
    refreshNano,
    startNanoDownload: trackNanoDownload,
  };

  function render(): void {
    const navTargetToRefocus = focusedNavTarget();
    railHost.replaceChildren(renderNavRail(dispatch));
    screenHost.replaceChildren(SCREENS[screen](dispatch));
    if (navTargetToRefocus !== undefined) {
      railHost.querySelector<HTMLElement>(`[data-nav-target="${navTargetToRefocus}"]`)?.focus();
    }
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

  if (screen === "main") {
    screenHost.querySelector<HTMLElement>(".pz-power-button")?.focus();
  }
}
