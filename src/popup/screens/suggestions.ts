import { banner, headerSub, screenShell, sectionHeading, settingRow, toggle } from "../components";
import { allCategoriesOff, hasConnectedCloudProvider, type SuggestCategory } from "../state-types";
import type { Dispatch } from "../types";

interface CategoryRow {
  id: SuggestCategory;
  label: string;
  sublabel: string;
}

const CATEGORY_ROWS: CategoryRow[] = [
  { id: "clarity", label: "Clarity", sublabel: "Reword vague or wordy parts" },
  { id: "gap", label: "Gaps", sublabel: "Point out a missing audience, format or constraint" },
  { id: "conflict", label: "Conflicts", sublabel: "Flag instructions that contradict each other" },
];

export function renderSuggestionsScreen(dispatch: Dispatch): HTMLElement {
  const state = dispatch.getState();
  const cloudConnected = hasConnectedCloudProvider(state);

  const body: (Node | string)[] = [
    sectionHeading("When"),
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
      label: "Allow as-you-type with cloud models",
      sublabel: cloudConnected
        ? "Sends drafts to your provider while you type. Uses your API quota."
        : "No cloud model connected",
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
    sectionHeading("What"),
  ];

  for (const row of CATEGORY_ROWS) {
    body.push(
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
  }

  if (allCategoriesOff(state.suggest)) {
    body.push(banner({ kind: "info", text: "Only Refine all is available." }));
  }

  body.push(
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
  );

  return screenShell(
    headerSub({ title: "Suggestions", drawerOpen: dispatch.isDrawerOpen(), onMenuClick: () => dispatch.openDrawer() }),
    body,
  );
}
