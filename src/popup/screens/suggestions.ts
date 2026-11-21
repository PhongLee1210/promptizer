import { el } from "../dom";
import { headerSub, screenShell, sectionHeading, settingRow, settingsGroup, toggle } from "../components";
import { allCategoriesOff, hasConnectedCloudProvider, type PopupState, type SuggestCategory } from "../state-types";
import type { Dispatch } from "../types";

interface CategoryRow {
  id: SuggestCategory;
  label: string;
  sublabel: string;
}

const CATEGORY_ROWS: CategoryRow[] = [
  { id: "clarity", label: "Clarity", sublabel: "Vague or wordy parts" },
  { id: "gap", label: "Gaps", sublabel: "Missing audience, format or limits" },
  { id: "conflict", label: "Conflicts", sublabel: "Instructions that contradict" },
];

function whenGroup(dispatch: Dispatch, state: PopupState): HTMLElement {
  const cloudConnected = hasConnectedCloudProvider(state);
  return settingsGroup(sectionHeading("When"), [
    settingRow({
      label: "Suggest as I type",
      sublabel: "Off: only when you click the badge",
      control: toggle({
        id: "pz-suggest-mode",
        checked: state.suggest.mode === "live",
        label: "Suggest as I type",
        onChange: async (checked) => {
          await dispatch.updateState((s) => ({
            ...s,
            suggest: { ...s.suggest, mode: checked ? "live" : "onRequest" },
          }));
        },
      }),
    }),
    settingRow({
      label: "Cloud models as you type",
      sublabel: cloudConnected ? "Sends drafts to your provider. Uses your API quota." : "No cloud model connected",
      control: toggle({
        id: "pz-suggest-cloud-live",
        checked: state.suggest.cloudLive && cloudConnected,
        disabled: !cloudConnected,
        label: "Allow as-you-type with cloud models",
        onChange: async (checked) => {
          await dispatch.updateState((s) => ({ ...s, suggest: { ...s.suggest, cloudLive: checked } }));
        },
      }),
    }),
  ]);
}

function whatGroup(dispatch: Dispatch, state: PopupState): HTMLElement {
  const notice = allCategoriesOff(state.suggest)
    ? el("span", { class: "pz-caption pz-warning-text", role: "status" }, ["Only Refine all is available."])
    : undefined;
  const rows = CATEGORY_ROWS.map((row) =>
    settingRow({
      label: row.label,
      sublabel: row.sublabel,
      control: toggle({
        id: `pz-suggest-${row.id}`,
        checked: state.suggest.categories[row.id],
        label: row.label,
        onChange: async (checked) => {
          await dispatch.updateState((s) => ({
            ...s,
            suggest: { ...s.suggest, categories: { ...s.suggest.categories, [row.id]: checked } },
          }));
        },
      }),
    }),
  );
  return settingsGroup(sectionHeading("What", undefined, notice), rows);
}

function displayGroup(dispatch: Dispatch, state: PopupState): HTMLElement {
  return settingsGroup(sectionHeading("Display"), [
    settingRow({
      label: "Underline suggestions in the text",
      control: toggle({
        id: "pz-suggest-underlines",
        checked: state.suggest.underlines,
        label: "Underline suggestions in the text",
        onChange: async (checked) => {
          await dispatch.updateState((s) => ({ ...s, suggest: { ...s.suggest, underlines: checked } }));
        },
      }),
    }),
  ]);
}

export function renderSuggestionsScreen(dispatch: Dispatch): HTMLElement {
  const state = dispatch.getState();
  return screenShell(headerSub({ title: "Suggestions" }), [
    whenGroup(dispatch, state),
    whatGroup(dispatch, state),
    displayGroup(dispatch, state),
  ]);
}
