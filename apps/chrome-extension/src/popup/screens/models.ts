import { el, iconEl } from "../dom";
import { headerSub, iconButton, navRow, screenShell, sectionHeading, settingRow } from "../components";
import { countConnectedProviders } from "../main-view";
import { PROVIDER_CATALOG, type CatalogModel } from "../provider-catalog";
import { statusForProvider, SWITCH_TIMEOUT_OPTIONS, type ModelSlot, type PopupState } from "../state-types";
import type { Dispatch } from "../types";

const ROLE_LABELS = ["Primary", "Secondary", "Fallback"];

let openPickerIndex: number | null = null;

function statusLine(state: PopupState, slot: ModelSlot): string {
  const provider = state.providers.find((p) => p.id === slot.providerId);
  const status = provider === undefined ? slot.status : statusForProvider(provider);
  if (status === "ready") {
    return slot.device === "on-device" ? "On-device, Ready, no key" : `${slot.providerLabel}, key connected`;
  }
  if (status === "key-needed") {
    return "Key needed";
  }
  if (status === "downloading") {
    return `Downloading ${slot.downloadPercent ?? 0}%`;
  }
  if (status === "unavailable") {
    return "Not available on this computer";
  }
  return "Error";
}

function catalogOptionsExcluding(state: PopupState, skipIndex: number): CatalogModel[] {
  const usedProviderIds = new Set(state.modelOrder.filter((_, i) => i !== skipIndex).map((s) => s.providerId));
  return PROVIDER_CATALOG.filter((entry) => !usedProviderIds.has(entry.providerId));
}

function pickerFor(dispatch: Dispatch, index: number, currentlyFilled: boolean): HTMLElement {
  const state = dispatch.getState();
  const options = catalogOptionsExcluding(state, index);
  const select = el("select", { class: "pz-select", "aria-label": `Choose a model for ${ROLE_LABELS[index]}` });
  select.append(el("option", { value: "", hidden: "", selected: "" }, ["Choose a model"]));
  const byProvider = new Map<string, CatalogModel[]>();
  for (const entry of options) {
    const list = byProvider.get(entry.providerLabel) ?? [];
    list.push(entry);
    byProvider.set(entry.providerLabel, list);
  }
  for (const [providerLabel, entries] of byProvider) {
    const group = el("optgroup", { label: providerLabel }, [el("legend", {}, [providerLabel])]);
    for (const entry of entries) {
      group.append(el("option", { value: `${entry.providerId}::${entry.modelName}` }, [entry.modelName]));
    }
    select.append(group);
  }
  if (currentlyFilled) {
    select.append(el("hr"), el("option", { value: "empty" }, ["Leave this slot empty"]));
  }
  select.addEventListener("change", async () => {
    const value = select.value;
    if (value === "") {
      return;
    }
    openPickerIndex = null;
    await dispatch.updateState((s) => {
      const next = [...s.modelOrder];
      if (value === "empty") {
        next.splice(index, 1);
        return { ...s, modelOrder: next };
      }
      const [providerId, modelName] = value.split("::");
      const entry = PROVIDER_CATALOG.find((c) => c.providerId === providerId && c.modelName === modelName)!;
      const slot: ModelSlot = {
        providerId: entry.providerId,
        providerLabel: entry.providerLabel,
        modelName: entry.modelName,
        device: entry.device,
        status: "ready",
      };
      if (index < next.length) {
        next[index] = slot;
      } else {
        next.push(slot);
      }
      return { ...s, modelOrder: next };
    });
  });
  return select;
}

function slotCard(dispatch: Dispatch, index: number, slot: ModelSlot | undefined): HTMLElement {
  if (slot === undefined) {
    const addSlotButton = el("button", { class: "pz-model-slot pz-model-slot--empty pz-control" }, [
      iconEl("plus", 18),
      el("span", { class: "pz-body" }, ["Add a backup model"]),
    ]);
    addSlotButton.addEventListener("click", () => {
      openPickerIndex = index;
      dispatch.rerender();
    });
    return addSlotButton;
  }

  const state = dispatch.getState();

  const moveUp = iconButton({
    iconName: "chevron-down",
    label: `Move ${slot.modelName} up`,
    size: 16,
    extraClass: "pz-icon-button--small",
    iconClass: "pz-rotate-180",
    onClick: async () => {
      await dispatch.updateState((s) => {
        const next = [...s.modelOrder];
        [next[index - 1], next[index]] = [next[index]!, next[index - 1]!];
        return { ...s, modelOrder: next };
      });
    },
  });
  const moveDown = iconButton({
    iconName: "chevron-down",
    label: `Move ${slot.modelName} down`,
    size: 16,
    extraClass: "pz-icon-button--small",
    onClick: async () => {
      await dispatch.updateState((s) => {
        const next = [...s.modelOrder];
        [next[index], next[index + 1]] = [next[index + 1]!, next[index]!];
        return { ...s, modelOrder: next };
      });
    },
  });

  const isPickerOpen = openPickerIndex === index;
  const pickerPanel = el("div", { class: "pz-model-slot__picker", "data-slot-index": String(index) }, [
    el("div", { class: "pz-model-slot__picker-inner" }, [pickerFor(dispatch, index, true)]),
  ]);
  const pickerToggle = el(
    "button",
    {
      class: "pz-model-slot__labels pz-control",
      "aria-label": `Change ${ROLE_LABELS[index]} model, currently ${slot.modelName}`,
    },
    [
      el("span", { class: "pz-body-strong" }, [slot.modelName]),
      el("span", { class: "pz-caption pz-text-muted" }, [statusLine(state, slot)]),
    ],
  );
  setPickerOpen(pickerPanel, pickerToggle, isPickerOpen);
  pickerToggle.addEventListener("click", () => togglePicker(index));

  const canMoveUp = index > 0;
  const canMoveDown = index < state.modelOrder.length - 1;
  const body = el("div", { class: "pz-model-slot__row" }, [
    iconEl("drag-handle", 16),
    pickerToggle,
    ...(canMoveUp ? [moveUp] : []),
    ...(canMoveDown ? [moveDown] : []),
  ]);

  return el("div", { class: "pz-model-slot pz-model-slot--filled" }, [
    el("div", { class: "pz-model-slot__header" }, [
      el("span", { class: "pz-overline pz-text-muted" }, [ROLE_LABELS[index] ?? "Slot"]),
    ]),
    body,
    pickerPanel,
  ]);
}

function setPickerOpen(panel: HTMLElement, toggleButton: HTMLElement | null, open: boolean): void {
  panel.toggleAttribute("data-open", open);
  panel.toggleAttribute("inert", !open);
  toggleButton?.setAttribute("aria-expanded", String(open));
}

function togglePicker(index: number): void {
  openPickerIndex = openPickerIndex === index ? null : index;
  for (const panel of document.querySelectorAll<HTMLElement>(".pz-model-slot__picker")) {
    const toggleButton = panel.parentElement?.querySelector<HTMLElement>(".pz-model-slot__labels") ?? null;
    setPickerOpen(panel, toggleButton, panel.dataset.slotIndex === String(openPickerIndex));
  }
}

export function renderModelsScreen(dispatch: Dispatch): HTMLElement {
  const state = dispatch.getState();

  const slots = [0, 1, 2].map((index) => {
    const slot = state.modelOrder[index];
    if (slot === undefined && openPickerIndex === index) {
      return el("div", { class: "pz-model-slot" }, [
        el("div", { class: "pz-model-slot__header" }, [
          el("span", { class: "pz-overline pz-text-muted" }, [ROLE_LABELS[index] ?? "Slot"]),
        ]),
        pickerFor(dispatch, index, false),
      ]);
    }
    return slotCard(dispatch, index, slot);
  });

  const timeoutSelect = el("select", { class: "pz-select", id: "pz-timeout" });
  for (const seconds of SWITCH_TIMEOUT_OPTIONS) {
    const option = el("option", { value: String(seconds) }, [`${seconds} s`]);
    if (seconds === state.switchTimeoutSeconds) {
      option.setAttribute("selected", "");
    }
    timeoutSelect.append(option);
  }
  timeoutSelect.addEventListener("change", async () => {
    await dispatch.updateState((s) => ({ ...s, switchTimeoutSeconds: Number(timeoutSelect.value) }));
  });

  return screenShell(
    headerSub({
      title: "Models & keys",
    }),
    [
      sectionHeading("Model order", "Tried from top to bottom."),
      el("div", { class: "pz-list" }, slots),
      settingRow({ label: "Move to the next model after", control: timeoutSelect }),
      navRow({
        label: "Providers & API keys",
        value: `${countConnectedProviders(state)} connected`,
        onClick: () => dispatch.goTo("providers"),
      }),
      el("p", { class: "pz-footer-note pz-micro" }, ["If every model fails, your prompt is sent unchanged."]),
    ],
  );
}
