import { el } from "../dom";
import {
  banner,
  button,
  cardLink,
  footerNote,
  headerMain,
  powerButton,
  screenShell,
  settingRow,
  statusPill,
  toggle,
} from "../components";
import { deriveMainView, type MainView } from "../main-view";
import { addCurrentSiteAsPlatform, canAddCurrentTab } from "../site-actions";
import type { Dispatch } from "../types";
import type { ModelSlot, PopupState } from "../state-types";

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

function modelCard(dispatch: Dispatch, slots: ModelSlot[], expanded: boolean): HTMLElement {
  const rows: HTMLElement[] = [];
  if (expanded) {
    slots.forEach((slot, index) => {
      rows.push(slotRow(slot, `${index + 1}`));
      if (slot.status === "downloading") {
        rows.push(
          el("div", { class: "pz-progress-track" }, [
            el("div", { class: "pz-progress-fill", style: `width: ${slot.downloadPercent ?? 0}%` }),
          ]),
        );
      }
    });
  } else {
    rows.push(slotRow(slots[0]!));
    const fallback = slots[1];
    if (fallback !== undefined) {
      rows.push(el("p", { class: "pz-caption pz-text-muted" }, [`If it fails: ${fallback.modelName}, then more`]));
    }
  }
  return cardLink({ label: "Model", onClick: () => dispatch.goTo("models"), children: rows });
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
  return statusPill("Needs attention", "error");
}

export function renderMainScreen(dispatch: Dispatch): HTMLElement {
  const state = dispatch.getState();
  const hostname = dispatch.getActiveHostname();
  const view = deriveMainView(state, hostname);
  const compact = view.kind === "backup" || view.kind === "all-failing";
  const powerOn = state.globalEnabled;
  const copy = heroCopy(state, view);

  const powerButtonNode = powerButton({
    on: powerOn,
    compact,
    onClick: async () => {
      await dispatch.updateState((s) => ({ ...s, globalEnabled: !s.globalEnabled }));
      dispatch.announce(powerOn ? "Suggestions paused" : "Suggestions active");
    },
  });

  const body: (Node | string)[] = [
    el("div", { class: "pz-main-hero" }, [
      powerButtonNode,
      el("p", { class: "pz-title" }, [copy.title]),
      el("p", { class: "pz-caption pz-text-muted" }, [copy.caption]),
    ]),
  ];

  if (view.kind === "unsupported") {
    body.push(
      el("p", { class: "pz-body pz-text-muted pz-ineligible-note" }, ["No chat box found on this site"]),
      button({
        label: "Add this site",
        variant: "outline",
        disabled: !canAddCurrentTab(dispatch),
        onClick: async () => {
          await addCurrentSiteAsPlatform(dispatch);
        },
      }),
    );
  } else {
    const site =
      hostname === undefined
        ? undefined
        : state.platforms.find((p) => hostname === p.hostname || hostname.endsWith(`.${p.hostname}`));
    if (site !== undefined) {
      body.push(
        settingRow({
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
        }),
      );
    }
  }

  if (view.kind === "primary-unavailable") {
    body.push(
      el("div", { class: "pz-card" }, [
        el("p", { class: "pz-overline pz-text-muted" }, ["Model"]),
        el("p", { class: "pz-body" }, ["Gemini Nano isn't available on this computer"]),
        button({ label: "Add a backup model", onClick: () => dispatch.goTo("models") }),
      ]),
    );
  } else if (view.kind === "backup") {
    body.push(
      modelCard(dispatch, view.allSlots, true),
      banner({
        kind: "warning",
        text: `While a cloud model is in use, your prompt text is sent to ${view.slot.providerLabel}.`,
      }),
    );
  } else if (view.kind === "active") {
    body.push(modelCard(dispatch, state.modelOrder, false));
  }

  if (view.kind === "all-failing") {
    body.push(
      banner({
        kind: "danger",
        text: "Couldn't reach any model. Prompts are being sent unchanged.",
        action: button({ label: "Check models", variant: "text", onClick: () => dispatch.goTo("models") }),
      }),
    );
  }

  if (!compact) {
    body.push(footerNote("On-device suggestions never leave your computer."));
  }

  return screenShell(
    headerMain({
      statusPillNode: statusPillFor(view),
      drawerOpen: dispatch.isDrawerOpen(),
      onMenuClick: () => dispatch.openDrawer(),
    }),
    body,
  );
}
