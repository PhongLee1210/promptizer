import { beforeEach, describe, expect, it, vi } from "vitest";
import { ActionRail, type RailCallbacks } from "../rail";
import type { ChipView } from "../chip-state";

function callbacks(): RailCallbacks & Record<keyof RailCallbacks, ReturnType<typeof vi.fn>> {
  return {
    onSelectLeaf: vi.fn(),
    onToggleGroup: vi.fn(),
    onRecentOpened: vi.fn(),
    onTurnOff: vi.fn(),
  };
}

const CLOSED: ChipView = { kind: "closed" };
const OPEN: ChipView = { kind: "rail", openGroup: null };

describe("ActionRail", () => {
  let spies: ReturnType<typeof callbacks>;
  let rail: ActionRail;

  beforeEach(() => {
    spies = callbacks();
    rail = new ActionRail(spies);
    document.body.replaceChildren(rail.node());
  });

  it("stays hidden and empty while closed", () => {
    rail.render(CLOSED, "chat", false);
    expect(rail.node().dataset.open).toBe("false");
    expect(rail.node().querySelectorAll("button")).toHaveLength(0);
  });

  it("shows refine first for a chat context, without recent results by default", () => {
    rail.render(OPEN, "chat", false);
    const items = [...rail.node().querySelectorAll('[role="menuitem"]')] as HTMLButtonElement[];
    expect(items.map((item) => item.getAttribute("aria-label"))).toEqual([
      "Refine prompt",
      "Fix grammar",
      "Shorten",
      "Translate",
      "Change tone",
      "Turn off",
    ]);
  });

  it("appends a turn-off entry even without history", () => {
    rail.render(OPEN, "chat", false);
    const items = [...rail.node().querySelectorAll('[role="menuitem"]')] as HTMLButtonElement[];
    expect(items.at(-1)?.getAttribute("aria-label")).toBe("Turn off");
    items.at(-1)!.click();
    expect(spies.onTurnOff).toHaveBeenCalled();
  });

  it("shows improve instead of refine for an editor context", () => {
    rail.render(OPEN, "editor", false);
    const first = rail.node().querySelector('[role="menuitem"]') as HTMLButtonElement;
    expect(first.getAttribute("aria-label")).toBe("Improve writing");
  });

  it("appends a recent-results entry only when history exists", () => {
    rail.render(OPEN, "chat", true);
    const items = [...rail.node().querySelectorAll('[role="menuitem"]')] as HTMLButtonElement[];
    expect(items.at(-2)?.getAttribute("aria-label")).toBe("Recent results");
    items.at(-2)!.click();
    expect(spies.onRecentOpened).toHaveBeenCalled();
  });

  it("runs a leaf action directly", () => {
    rail.render(OPEN, "chat", false);
    const grammar = [...rail.node().querySelectorAll('[role="menuitem"]')].find(
      (b) => b.getAttribute("aria-label") === "Fix grammar",
    ) as HTMLButtonElement;
    grammar.click();
    expect(spies.onSelectLeaf).toHaveBeenCalledWith("grammar");
  });

  it("opens the translate strip with vi/en leaves", () => {
    rail.render({ kind: "rail", openGroup: "translate" }, "chat", false);
    const strip = rail.node().querySelector(".pz-rail__strip");
    expect(strip).not.toBeNull();
    const leaves = [...strip!.querySelectorAll("button")];
    expect(leaves.map((b) => b.getAttribute("aria-label"))).toEqual(["Vietnamese", "English"]);
    leaves[0]!.click();
    expect(spies.onSelectLeaf).toHaveBeenCalledWith("vi");
  });

  it("opens the tone strip with pro/friendly/direct leaves", () => {
    rail.render({ kind: "rail", openGroup: "tone" }, "chat", false);
    const strip = rail.node().querySelector(".pz-rail__strip");
    const leaves = [...strip!.querySelectorAll("button")];
    expect(leaves.map((b) => b.getAttribute("aria-label"))).toEqual(["Professional", "Friendly", "Direct"]);
  });

  it("toggles a group when its rail button is clicked", () => {
    rail.render(OPEN, "chat", false);
    const translate = [...rail.node().querySelectorAll('[role="menuitem"]')].find(
      (b) => b.getAttribute("aria-label") === "Translate",
    ) as HTMLButtonElement;
    translate.click();
    expect(spies.onToggleGroup).toHaveBeenCalledWith("translate");
  });

  it("gives the rail one tab stop and walks it with the arrow keys", () => {
    rail.render(OPEN, "chat", false);
    const items = [...rail.node().querySelectorAll('[role="menuitem"]')] as HTMLButtonElement[];
    expect(items.map((item) => item.tabIndex)).toEqual([0, -1, -1, -1, -1, -1]);

    items[0]!.focus();
    items[0]!.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
    expect(document.activeElement).toBe(items[1]);
  });

  it("wraps around the ends of the rail", () => {
    rail.render(OPEN, "chat", false);
    const items = [...rail.node().querySelectorAll('[role="menuitem"]')] as HTMLButtonElement[];

    items[0]!.focus();
    items[0]!.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowUp", bubbles: true }));
    expect(document.activeElement).toBe(items.at(-1));
  });

  it("moves focus to the first item on request", () => {
    rail.render(OPEN, "chat", false);
    rail.focusFirstItem();
    expect(document.activeElement?.getAttribute("aria-label")).toBe("Refine prompt");
  });
});
