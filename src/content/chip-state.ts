import type { ActionId, ActionSource, RailGroupId } from "./action-types";

export const UNDO_WINDOW_MS = 6000;
export const HISTORY_LIMIT = 10;
export const EMPTY_TEXT_MESSAGE = "Type something first.";

export interface ResultEntry {
  readonly id: string;
  readonly action: ActionId;
  readonly source: ActionSource;
  readonly title: string;
  readonly text: string;
  readonly edited: boolean;
}

export type Outcome = { kind: "ok"; title: string; text: string } | { kind: "error"; message: string };

export type ChipView =
  | { kind: "closed" }
  | { kind: "rail"; openGroup: RailGroupId | null }
  | { kind: "loading"; action: ActionId; source: ActionSource }
  | { kind: "preparing"; action: ActionId; source: ActionSource; percent: number }
  | { kind: "result" }
  | { kind: "editing"; draft: string }
  | { kind: "tweak" }
  | { kind: "error"; action: ActionId; source: ActionSource; message: string };

export interface ChipState {
  readonly view: ChipView;
  readonly results: readonly ResultEntry[];
  readonly index: number;
  readonly replaced: boolean;
  readonly copied: boolean;
}

export type ChipEvent =
  | { type: "chip-clicked" }
  | { type: "group-toggled"; group: RailGroupId }
  | { type: "action-selected"; action: ActionId; source: ActionSource; hasText: boolean }
  | { type: "outcome-arrived"; id: string; action: ActionId; source: ActionSource; outcome: Outcome }
  | { type: "prepare-progress"; percent: number }
  | { type: "run-cancelled" }
  | { type: "step"; direction: -1 | 1 }
  | { type: "recent-opened" }
  | { type: "delete-current" }
  | { type: "edit-started" }
  | { type: "edit-discarded" }
  | { type: "edit-saved"; text: string }
  | { type: "tweak-toggled" }
  | { type: "copy-requested" }
  | { type: "copy-reset" }
  | { type: "replaced" }
  | { type: "undone" }
  | { type: "undo-expired" }
  | { type: "dismissed" }
  | { type: "editor-left" };

export const initialChipState: ChipState = {
  view: { kind: "closed" },
  results: [],
  index: -1,
  replaced: false,
  copied: false,
};

function closeView(state: ChipState): ChipState {
  return state.view.kind === "closed" ? state : { ...state, view: { kind: "closed" } };
}

function clampIndex(index: number, length: number): number {
  return Math.min(Math.max(index, 0), length - 1);
}

export function currentResult(state: ChipState): ResultEntry | null {
  return state.results[state.index] ?? null;
}

export function reduceChipState(state: ChipState, event: ChipEvent): ChipState {
  switch (event.type) {
    case "chip-clicked":
      return state.view.kind === "closed" ? { ...state, view: { kind: "rail", openGroup: null } } : closeView(state);

    case "group-toggled":
      if (state.view.kind !== "rail") {
        return state;
      }
      return {
        ...state,
        view: { kind: "rail", openGroup: state.view.openGroup === event.group ? null : event.group },
      };

    case "action-selected":
      return {
        ...state,
        view: event.hasText
          ? { kind: "loading", action: event.action, source: event.source }
          : { kind: "error", action: event.action, source: event.source, message: EMPTY_TEXT_MESSAGE },
      };

    case "outcome-arrived": {
      if (event.outcome.kind === "error") {
        return {
          ...state,
          view: { kind: "error", action: event.action, source: event.source, message: event.outcome.message },
        };
      }
      const entry: ResultEntry = {
        id: event.id,
        action: event.action,
        source: event.source,
        title: event.outcome.title,
        text: event.outcome.text,
        edited: false,
      };
      const results = [...state.results, entry].slice(-HISTORY_LIMIT);
      return { ...state, results, index: results.length - 1, view: { kind: "result" } };
    }

    case "prepare-progress": {
      if (state.view.kind !== "loading" && state.view.kind !== "preparing") {
        return state;
      }
      const percent = Math.min(100, Math.max(0, Math.round(event.percent)));
      if (state.view.kind === "preparing" && state.view.percent === percent) {
        return state;
      }
      return {
        ...state,
        view: { kind: "preparing", action: state.view.action, source: state.view.source, percent },
      };
    }

    case "run-cancelled":
      return { ...state, view: { kind: "rail", openGroup: null } };

    case "step": {
      if (state.results.length === 0) {
        return state;
      }
      const index = clampIndex(state.index + event.direction, state.results.length);
      const view = state.view.kind === "editing" ? { kind: "result" as const } : state.view;
      return { ...state, index, view };
    }

    case "recent-opened":
      if (state.results.length === 0) {
        return state;
      }
      return { ...state, index: state.results.length - 1, view: { kind: "result" } };

    case "delete-current": {
      if (currentResult(state) === null) {
        return state;
      }
      const results = state.results.filter((_, i) => i !== state.index);
      if (results.length === 0) {
        return { ...state, results, index: -1, view: { kind: "closed" } };
      }
      return { ...state, results, index: clampIndex(state.index, results.length), view: { kind: "result" } };
    }

    case "edit-started": {
      const current = currentResult(state);
      if (current === null) {
        return state;
      }
      return { ...state, view: { kind: "editing", draft: current.text } };
    }

    case "edit-discarded":
      return state.view.kind === "editing" ? { ...state, view: { kind: "result" } } : state;

    case "edit-saved": {
      const current = currentResult(state);
      if (state.view.kind !== "editing" || current === null) {
        return state;
      }
      const edited = current.edited || event.text !== current.text;
      const results = state.results.map((entry, i) =>
        i === state.index ? { ...entry, text: event.text, edited } : entry,
      );
      return { ...state, results, view: { kind: "result" } };
    }

    case "tweak-toggled":
      if (state.view.kind === "result") {
        return { ...state, view: { kind: "tweak" } };
      }
      if (state.view.kind === "tweak") {
        return { ...state, view: { kind: "result" } };
      }
      return state;

    case "copy-requested":
      return { ...state, copied: true };

    case "copy-reset":
      return state.copied ? { ...state, copied: false } : state;

    case "replaced":
      return state.replaced ? state : { ...state, replaced: true };

    case "undone":
    case "undo-expired":
      return state.replaced ? { ...state, replaced: false } : state;

    case "dismissed":
    case "editor-left":
      return closeView(state);
  }
}
