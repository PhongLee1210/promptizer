import { describe, expect, it } from "vitest";
import {
  currentResult,
  initialChipState,
  reduceChipState,
  EMPTY_TEXT_MESSAGE,
  HISTORY_LIMIT,
  type ChipEvent,
  type ChipState,
  type Outcome,
} from "../chip-state";

const OK: Outcome = { kind: "ok", title: "Refined prompt", text: "This is a draft, refined." };
const FAILED: Outcome = { kind: "error", message: "Couldn't refine this draft" };

function reduceAll(events: ChipEvent[], from: ChipState = initialChipState): ChipState {
  return events.reduce(reduceChipState, from);
}

describe("reduceChipState", () => {
  it("starts closed with no results", () => {
    expect(initialChipState).toEqual({
      view: { kind: "closed" },
      results: [],
      index: -1,
      replaced: false,
      copied: false,
    });
  });

  it("opens the rail on the first chip click and closes it on the second", () => {
    const opened = reduceChipState(initialChipState, { type: "chip-clicked" });
    expect(opened.view).toEqual({ kind: "rail", openGroup: null });
    expect(reduceChipState(opened, { type: "chip-clicked" }).view).toEqual({ kind: "closed" });
  });

  it("closes any open view when the chip is clicked", () => {
    const withResult = reduceAll([
      { type: "action-selected", action: "refine", source: "text", hasText: true },
      { type: "outcome-arrived", id: "a", action: "refine", source: "text", outcome: OK },
    ]);
    expect(reduceChipState(withResult, { type: "chip-clicked" }).view).toEqual({ kind: "closed" });
  });

  it("toggles a rail group open and closed", () => {
    const opened = reduceAll([{ type: "chip-clicked" }, { type: "group-toggled", group: "tone" }]);
    expect(opened.view).toEqual({ kind: "rail", openGroup: "tone" });
    const closed = reduceChipState(opened, { type: "group-toggled", group: "tone" });
    expect(closed.view).toEqual({ kind: "rail", openGroup: null });
  });

  it("runs the action when the editor has text", () => {
    const state = reduceAll([
      { type: "chip-clicked" },
      { type: "action-selected", action: "grammar", source: "text", hasText: true },
    ]);
    expect(state.view).toEqual({ kind: "loading", action: "grammar", source: "text" });
  });

  it("moves to the error view when the action is selected with no text", () => {
    const rail = reduceChipState(initialChipState, { type: "chip-clicked" });
    const state = reduceChipState(rail, { type: "action-selected", action: "refine", source: "text", hasText: false });
    expect(state.view).toEqual({ kind: "error", action: "refine", source: "text", message: EMPTY_TEXT_MESSAGE });
  });

  it("pushes a result and moves to the result view on success", () => {
    const state = reduceAll([
      { type: "action-selected", action: "refine", source: "text", hasText: true },
      { type: "outcome-arrived", id: "a", action: "refine", source: "text", outcome: OK },
    ]);
    expect(state.view).toEqual({ kind: "result" });
    expect(state.results).toEqual([
      { id: "a", action: "refine", source: "text", title: OK.title, text: OK.text, edited: false },
    ]);
    expect(state.index).toBe(0);
  });

  it("moves to the error view when the action fails, keeping prior results", () => {
    const withResult = reduceAll([
      { type: "action-selected", action: "refine", source: "text", hasText: true },
      { type: "outcome-arrived", id: "a", action: "refine", source: "text", outcome: OK },
    ]);
    const state = reduceChipState(withResult, {
      type: "outcome-arrived",
      id: "b",
      action: "grammar",
      source: "text",
      outcome: FAILED,
    });
    expect(state.view).toEqual({ kind: "error", action: "grammar", source: "text", message: FAILED.message });
    expect(state.results).toHaveLength(1);
  });

  it("caps history at HISTORY_LIMIT, dropping the oldest", () => {
    const events: ChipEvent[] = [];
    for (let i = 0; i < HISTORY_LIMIT + 1; i += 1) {
      events.push({ type: "outcome-arrived", id: String(i), action: "refine", source: "text", outcome: OK });
    }
    const state = reduceAll(events);
    expect(state.results).toHaveLength(HISTORY_LIMIT);
    expect(state.results[0]!.id).toBe("1");
    expect(state.results.at(-1)!.id).toBe(String(HISTORY_LIMIT));
    expect(state.index).toBe(HISTORY_LIMIT - 1);
  });

  it("returns to the rail when a running action is cancelled", () => {
    const state = reduceAll([
      { type: "action-selected", action: "refine", source: "text", hasText: true },
      { type: "run-cancelled" },
    ]);
    expect(state.view).toEqual({ kind: "rail", openGroup: null });
  });

  it("steps between results and clamps at the bounds", () => {
    const withTwo = reduceAll([
      { type: "outcome-arrived", id: "a", action: "refine", source: "text", outcome: OK },
      { type: "outcome-arrived", id: "b", action: "refine", source: "text", outcome: OK },
    ]);
    expect(withTwo.index).toBe(1);
    const back = reduceChipState(withTwo, { type: "step", direction: -1 });
    expect(back.index).toBe(0);
    expect(reduceChipState(back, { type: "step", direction: -1 }).index).toBe(0);
    expect(reduceChipState(withTwo, { type: "step", direction: 1 }).index).toBe(1);
  });

  it("exits editing when stepping to another result", () => {
    const editing = reduceAll([
      { type: "outcome-arrived", id: "a", action: "refine", source: "text", outcome: OK },
      { type: "outcome-arrived", id: "b", action: "refine", source: "text", outcome: OK },
      { type: "edit-started" },
    ]);
    expect(editing.view.kind).toBe("editing");
    const stepped = reduceChipState(editing, { type: "step", direction: -1 });
    expect(stepped.view).toEqual({ kind: "result" });
  });

  it("reopens at the newest result on recent-opened", () => {
    const withHistory = reduceAll([
      { type: "outcome-arrived", id: "a", action: "refine", source: "text", outcome: OK },
      { type: "outcome-arrived", id: "b", action: "refine", source: "text", outcome: OK },
      { type: "step", direction: -1 },
      { type: "dismissed" },
    ]);
    expect(withHistory.index).toBe(0);
    const reopened = reduceChipState(withHistory, { type: "recent-opened" });
    expect(reopened.view).toEqual({ kind: "result" });
    expect(reopened.index).toBe(1);
  });

  it("deletes the current result and closes the view once empty", () => {
    const withOne = reduceAll([{ type: "outcome-arrived", id: "a", action: "refine", source: "text", outcome: OK }]);
    const deleted = reduceChipState(withOne, { type: "delete-current" });
    expect(deleted.results).toHaveLength(0);
    expect(deleted.view).toEqual({ kind: "closed" });
  });

  it("deletes the current result and clamps the index when others remain", () => {
    const withTwo = reduceAll([
      { type: "outcome-arrived", id: "a", action: "refine", source: "text", outcome: OK },
      { type: "outcome-arrived", id: "b", action: "refine", source: "text", outcome: OK },
    ]);
    const deleted = reduceChipState(withTwo, { type: "delete-current" });
    expect(deleted.results).toEqual([
      { id: "a", action: "refine", source: "text", title: OK.title, text: OK.text, edited: false },
    ]);
    expect(deleted.index).toBe(0);
    expect(deleted.view).toEqual({ kind: "result" });
  });

  it("edits a result in place and saves it", () => {
    const withResult = reduceAll([{ type: "outcome-arrived", id: "a", action: "refine", source: "text", outcome: OK }]);
    const editing = reduceChipState(withResult, { type: "edit-started" });
    expect(editing.view).toEqual({ kind: "editing", draft: OK.text });
    const saved = reduceChipState(editing, { type: "edit-saved", text: "edited text" });
    expect(saved.view).toEqual({ kind: "result" });
    expect(currentResult(saved)?.text).toBe("edited text");
    expect(currentResult(saved)?.edited).toBe(true);
  });

  it("does not mark a result edited when a save keeps the same text", () => {
    const withResult = reduceAll([{ type: "outcome-arrived", id: "a", action: "refine", source: "text", outcome: OK }]);
    const editing = reduceChipState(withResult, { type: "edit-started" });
    const saved = reduceChipState(editing, { type: "edit-saved", text: OK.text });
    expect(currentResult(saved)?.edited).toBe(false);
  });

  it("keeps a result marked edited across a later no-op save", () => {
    const withResult = reduceAll([{ type: "outcome-arrived", id: "a", action: "refine", source: "text", outcome: OK }]);
    const firstEdit = reduceChipState(reduceChipState(withResult, { type: "edit-started" }), {
      type: "edit-saved",
      text: "changed once",
    });
    const secondEdit = reduceChipState(reduceChipState(firstEdit, { type: "edit-started" }), {
      type: "edit-saved",
      text: "changed once",
    });
    expect(currentResult(secondEdit)?.edited).toBe(true);
  });

  it("discards an edit without changing the result text", () => {
    const withResult = reduceAll([{ type: "outcome-arrived", id: "a", action: "refine", source: "text", outcome: OK }]);
    const editing = reduceChipState(withResult, { type: "edit-started" });
    const discarded = reduceChipState(editing, { type: "edit-discarded" });
    expect(discarded.view).toEqual({ kind: "result" });
    expect(currentResult(discarded)?.text).toBe(OK.text);
  });

  it("toggles tweak on and back off", () => {
    const withResult = reduceAll([{ type: "outcome-arrived", id: "a", action: "refine", source: "text", outcome: OK }]);
    const tweaking = reduceChipState(withResult, { type: "tweak-toggled" });
    expect(tweaking.view).toEqual({ kind: "tweak" });
    expect(reduceChipState(tweaking, { type: "tweak-toggled" }).view).toEqual({ kind: "result" });
  });

  it("sets and clears the copied flag", () => {
    const copied = reduceChipState(initialChipState, { type: "copy-requested" });
    expect(copied.copied).toBe(true);
    expect(reduceChipState(copied, { type: "copy-reset" }).copied).toBe(false);
  });

  it("marks replaced and clears it on undo or expiry", () => {
    const replaced = reduceChipState(initialChipState, { type: "replaced" });
    expect(replaced.replaced).toBe(true);
    expect(reduceChipState(replaced, { type: "undone" }).replaced).toBe(false);
    expect(reduceChipState(replaced, { type: "undo-expired" }).replaced).toBe(false);
  });

  it("closes the view on dismissed and editor-left without clearing history", () => {
    const withResult = reduceAll([{ type: "outcome-arrived", id: "a", action: "refine", source: "text", outcome: OK }]);
    const dismissed = reduceChipState(withResult, { type: "dismissed" });
    expect(dismissed.view).toEqual({ kind: "closed" });
    expect(dismissed.results).toHaveLength(1);
    const editorLeft = reduceChipState(withResult, { type: "editor-left" });
    expect(editorLeft.view).toEqual({ kind: "closed" });
    expect(editorLeft.results).toHaveLength(1);
  });
});
