import { el } from "../dom";
import {
  banner,
  button,
  footerNote,
  headerMain,
  powerButton,
  regionCard,
  screenShell,
  settingRow,
  statusPill,
  toggle,
  type PowerStep,
} from "../components";
import { deriveMainView, type MainView } from "../main-view";
import type { Dispatch } from "../types";
import type { ModelSlot, PlatformEntry, PopupState } from "../state-types";

function modelStatusLabel(slot: ModelSlot): string {
  if (slot.status === "ready") {
    return slot.device === "on-device" ? "On-device, Ready" : `${slot.providerLabel}, in use`;
  }
  if (slot.status === "downloading") {
    return `Downloading ${slot.downloadPercent ?? 0}%`;
  }
  if (slot.status === "key-needed") {
    return "Key needed";
  }
  if (slot.status === "unavailable") {
    return "Not available on this computer";
  }
  return "Error";
}

function slotRow(slot: ModelSlot, prefix?: string): HTMLElement {
  return el("div", { class: "pz-model-card__row" }, [
    el("span", { class: `pz-status-dot pz-status-dot--${slot.status === "ready" ? "ready" : "standing-by"}` }),
    el("span", { class: "pz-body-strong" }, [prefix === undefined ? slot.modelName : `${prefix} ${slot.modelName}`]),
    el("span", { class: "pz-caption pz-text-muted" }, [modelStatusLabel(slot)]),
  ]);
}

function modelCard(dispatch: Dispatch, inUse: ModelSlot, slots: ModelSlot[], expanded: boolean): HTMLElement {
  const footer: (Node | string)[] = [];
  if (expanded) {
    slots.forEach((slot, index) => {
      footer.push(slotRow(slot, `${index + 1}`));
      if (slot.status === "downloading") {
        footer.push(
          el("div", { class: "pz-progress-track" }, [
            el("div", { class: "pz-progress-fill", style: `width: ${slot.downloadPercent ?? 0}%` }),
          ]),
        );
      }
    });
  } else {
    const fallback = slots.find((slot) => slot !== inUse);
    if (fallback !== undefined) {
      footer.push(el("p", { class: "pz-caption pz-text-muted" }, [`If it fails: ${fallback.modelName}, then more`]));
    }
  }
  return regionCard({
    iconName: inUse.device === "on-device" ? "device" : "cloud",
    title: inUse.modelName,
    caption: [modelStatusLabel(inUse)],
    label: `Model: ${inUse.modelName}, ${modelStatusLabel(inUse)}`,
    onClick: () => dispatch.goTo("models"),
    footer,
  });
}

function suggestsOnRequest(state: PopupState, view: MainView): boolean {
  if (state.suggest.mode === "onRequest") {
    return true;
  }
  return view.kind === "active" && view.slot.device === "cloud" && !state.suggest.cloudLive;
}

function heroCopy(state: PopupState, view: MainView): { title: string; caption: string } {
  if (view.kind === "paused") {
    return { title: "Suggestions are paused", caption: "Nothing is analysed or changed" };
  }
  if (view.kind === "site-off") {
    return { title: `Off for ${view.site.label}`, caption: "Still on for your other platforms" };
  }
  if (view.kind === "backup") {
    return {
      title: "Suggesting with a backup model",
      caption: "Nothing for you to do. It switches back automatically",
    };
  }
  if (view.kind === "primary-unavailable") {
    return { title: "Can't suggest yet", caption: "Gemini Nano isn't available on this computer" };
  }
  if (view.kind === "nano-downloading") {
    return { title: "Setting up on-device AI", caption: `Gemini Nano is ${view.percent}% downloaded` };
  }
  if (view.kind === "nano-setup") {
    return {
      title: "On-device AI needs setup",
      caption:
        view.status === "unsupported"
          ? "Chrome reports no on-device model here"
          : "Gemini Nano hasn't been downloaded yet",
    };
  }
  if (view.kind === "unsupported") {
    return { title: "Not on a supported site", caption: "No chat box found in this tab" };
  }
  if (suggestsOnRequest(state, view)) {
    return { title: "Suggesting on request", caption: "Click the Promptizer badge in the message box" };
  }
  return { title: "Suggesting as you type", caption: "Start typing in the message box" };
}

function statusPillFor(view: MainView): HTMLElement {
  if (view.kind === "active") {
    return statusPill("Active", "ready");
  }
  if (view.kind === "paused") {
    return statusPill("Paused", "standing-by");
  }
  if (view.kind === "site-off") {
    return statusPill(`Off for ${view.site.label}`, "standing-by");
  }
  if (view.kind === "unsupported") {
    return statusPill("Not on this site", "standing-by");
  }
  if (view.kind === "backup") {
    return statusPill("Using backup", "warning");
  }
  if (view.kind === "nano-downloading") {
    return statusPill(`Setting up ${view.percent}%`, "warning");
  }
  if (view.kind === "nano-setup") {
    return statusPill("Setup needed", "warning");
  }
  return statusPill("Needs attention", "error");
}

function powerStepFor(view: MainView): PowerStep {
  if (view.kind === "nano-downloading") {
    return "busy";
  }
  return view.kind === "active" || view.kind === "backup" ? "on" : "off";
}

function siteForHostname(state: PopupState, hostname: string | undefined): PlatformEntry | undefined {
  if (hostname === undefined) {
    return undefined;
  }
  return state.platforms.find((p) => hostname === p.hostname || hostname.endsWith(`.${p.hostname}`));
}

function siteToggleRow(dispatch: Dispatch, site: PlatformEntry, powerOn: boolean): HTMLElement {
  return settingRow({
    label: `Suggest on ${site.label}`,
    control: toggle({
      id: "pz-site-toggle",
      checked: site.enabled,
      disabled: !powerOn,
      label: `Suggest on ${site.label}`,
      onChange: async (checked) => {
        await dispatch.updateState((s) => ({
          ...s,
          platforms: s.platforms.map((p) => (p.id === site.id ? { ...p, enabled: checked } : p)),
        }));
      },
    }),
  });
}

function modelRegion(dispatch: Dispatch, state: PopupState, view: MainView): HTMLElement | undefined {
  if (view.kind === "nano-downloading") {
    return el("div", { class: "pz-card", role: "status" }, [
      el("p", { class: "pz-overline pz-text-muted" }, ["Model"]),
      el("p", { class: "pz-body" }, [`Downloading Gemini Nano ${view.percent}%`]),
      el("div", { class: "pz-progress-track" }, [
        el("div", { class: "pz-progress-fill", style: `width: ${view.percent}%` }),
      ]),
      el("p", { class: "pz-caption pz-text-muted" }, ["Keep Chrome open until this finishes."]),
      button({ label: "Setup details", variant: "outline", onClick: () => dispatch.goTo("nano-setup") }),
    ]);
  }
  if (view.kind === "nano-setup") {
    return el("div", { class: "pz-card" }, [
      el("p", { class: "pz-overline pz-text-muted" }, ["Model"]),
      el("p", { class: "pz-body" }, [
        view.status === "unsupported"
          ? "Gemini Nano isn't enabled in this Chrome yet."
          : "Gemini Nano still needs a one-time download.",
      ]),
      button({ label: "Show setup steps", onClick: () => dispatch.goTo("nano-setup") }),
      button({ label: "Add a backup model", variant: "outline", onClick: () => dispatch.goTo("models") }),
    ]);
  }
  if (view.kind === "primary-unavailable") {
    return el("div", { class: "pz-card" }, [
      el("p", { class: "pz-overline pz-text-muted" }, ["Model"]),
      el("p", { class: "pz-body" }, ["Gemini Nano isn't available on this computer"]),
      button({ label: "Add a backup model", onClick: () => dispatch.goTo("models") }),
    ]);
  }
  if (view.kind === "backup") {
    return modelCard(dispatch, view.slot, view.allSlots, true);
  }
  if (view.kind === "active") {
    return modelCard(dispatch, view.slot, state.modelOrder, false);
  }
  return undefined;
}

export function renderMainScreen(dispatch: Dispatch): HTMLElement {
  const state = dispatch.getState();
  const hostname = dispatch.getActiveHostname();
  const view = deriveMainView(state, hostname);
  const compact = view.kind === "backup" || view.kind === "all-failing";
  const powerOn = state.globalEnabled;
  const copy = heroCopy(state, view);
  const site = view.kind === "unsupported" ? undefined : siteForHostname(state, hostname);

  const powerButtonNode = powerButton({
    on: powerOn,
    step: powerStepFor(view),
    compact,
    onClick: async () => {
      await dispatch.updateState((s) => ({ ...s, globalEnabled: !s.globalEnabled }));
      dispatch.announce(powerOn ? "Suggestions paused" : "Suggestions active");
    },
  });

  const region: HTMLElement[] = [];
  if (site !== undefined) {
    region.push(siteToggleRow(dispatch, site, powerOn));
  }
  const modelNode = modelRegion(dispatch, state, view);
  if (modelNode !== undefined) {
    region.push(modelNode);
  }

  const content: (Node | string)[] = [
    el("div", { class: "pz-main-connect" }, [powerButtonNode]),
    el("p", { class: "pz-main-status" }, [copy.title]),
    el("p", { class: "pz-caption pz-text-muted" }, [copy.caption]),
  ];
  if (region.length > 0) {
    content.push(el("div", { class: "pz-main-region" }, region));
  }

  if (view.kind === "backup") {
    content.push(
      banner({
        kind: "warning",
        text: `While a cloud model is in use, your prompt text is sent to ${view.slot.providerLabel}.`,
      }),
    );
  }
  if (view.kind === "all-failing") {
    content.push(
      banner({
        kind: "danger",
        text: "Couldn't reach any model. Prompts are being sent unchanged.",
        action: button({ label: "Check models", variant: "text", onClick: () => dispatch.goTo("models") }),
      }),
    );
  }
  if (!compact) {
    content.push(footerNote("On-device suggestions never leave your computer."));
  }

  return screenShell(
    headerMain({ statusPillNode: statusPillFor(view), siteLabel: site?.label }),
    [el("div", { class: "pz-main-content" }, content)],
    "main",
  );
}
