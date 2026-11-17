import { describe, expect, it } from "vitest";
import {
  CHIP_SIZE,
  PANEL_GAP,
  PANEL_MAX_WIDTH,
  RAIL_ITEM_SIZE,
  WINDOW_HEIGHT,
  WINDOW_WIDTH,
  placePanel,
  placeRail,
  placeStrip,
  placeWindow,
  type Rect,
  type Viewport,
} from "../anchor";

const DESKTOP: Viewport = { width: 1440, height: 900 };
const PANEL_HEIGHT = 280;

function anchorAt(top: number, right: number): Rect {
  const size = 20;
  return { top, right, bottom: top + size, left: right - size, width: size, height: size };
}

describe("placePanel", () => {
  it("opens above the anchor when there is room", () => {
    const placed = placePanel(anchorAt(700, 1000), PANEL_HEIGHT, DESKTOP);
    expect(placed.placement).toBe("above");
    expect(placed.bottomInset).toBe(DESKTOP.height - 700 + PANEL_GAP);
  });

  it("flips below when the anchor sits near the top of the viewport", () => {
    const placed = placePanel(anchorAt(40, 1000), PANEL_HEIGHT, DESKTOP);
    expect(placed.placement).toBe("below");
    expect(placed.bottomInset).toBe(DESKTOP.height - 60 - PANEL_GAP - PANEL_HEIGHT);
  });

  it("keeps the panel above when neither side has room, choosing the larger gap", () => {
    const shortViewport: Viewport = { width: 1440, height: 320 };
    const placed = placePanel(anchorAt(200, 1000), PANEL_HEIGHT, shortViewport);
    expect(placed.placement).toBe("above");
  });

  it("lines the panel up with the anchor's right edge", () => {
    const placed = placePanel(anchorAt(700, 1000), PANEL_HEIGHT, DESKTOP);
    expect(placed.rightInset).toBe(DESKTOP.width - 1000);
  });

  it("never lets the panel run past the right edge of the viewport", () => {
    const placed = placePanel(anchorAt(700, 1440), PANEL_HEIGHT, DESKTOP);
    expect(placed.rightInset).toBeGreaterThanOrEqual(12);
  });

  it("never lets the panel run past the left edge of the viewport", () => {
    const placed = placePanel(anchorAt(700, 200), PANEL_HEIGHT, DESKTOP);
    expect(placed.rightInset).toBeLessThanOrEqual(DESKTOP.width - PANEL_MAX_WIDTH - 12);
  });

  it("shrinks the panel on a viewport narrower than the panel itself", () => {
    const narrow: Viewport = { width: 320, height: 640 };
    const placed = placePanel(anchorAt(400, 300), PANEL_HEIGHT, narrow);
    expect(placed.maxWidth).toBe(320 - 24);
    expect(placed.rightInset).toBeGreaterThanOrEqual(12);
  });

  it("keeps the panel inside the viewport when it would hang off the bottom", () => {
    const placed = placePanel(anchorAt(10, 1000), PANEL_HEIGHT, { width: 1440, height: 200 });
    expect(placed.bottomInset).toBeGreaterThanOrEqual(12);
  });
});

describe("placeRail", () => {
  it("is always the fixed chip width regardless of item count", () => {
    const placed = placeRail(anchorAt(700, 1000), 5, DESKTOP);
    expect(placed.maxWidth).toBe(CHIP_SIZE);
  });

  it("grows taller with more items, still fitting above with room to spare", () => {
    const three = placeRail(anchorAt(700, 1000), 3, DESKTOP);
    const five = placeRail(anchorAt(700, 1000), 5, DESKTOP);
    expect(three.placement).toBe("above");
    expect(five.placement).toBe("above");
  });

  it("flips below once enough items make the rail too tall to fit above", () => {
    const placed = placeRail(anchorAt(60, 1000), 6, { width: 1440, height: 900 });
    expect(placed.placement).toBe("below");
  });
});

describe("placeWindow", () => {
  it("is always the fixed 280px window width", () => {
    const placed = placeWindow(anchorAt(700, 1000), DESKTOP);
    expect(placed.maxWidth).toBe(WINDOW_WIDTH);
  });

  it("uses the constant window height to decide above/below, never measuring the DOM", () => {
    const placed = placeWindow(anchorAt(700, 1000), DESKTOP);
    expect(placed.bottomInset).toBe(DESKTOP.height - 700 + PANEL_GAP);
    expect(WINDOW_HEIGHT).toBe(148);
  });
});

describe("placeStrip", () => {
  it("sits to the left of the owning rail item, top-aligned with it", () => {
    const railItem = anchorAt(300, 1000);
    const placed = placeStrip(railItem, 3, DESKTOP);
    expect(placed.topInset).toBe(railItem.top);
    expect(placed.width).toBe(3 * RAIL_ITEM_SIZE + 2 * 2);
    expect(placed.rightInset).toBe(DESKTOP.width - railItem.left + 5);
  });

  it("never produces a negative right inset", () => {
    const railItem = anchorAt(300, 10);
    const placed = placeStrip(railItem, 2, { width: 100, height: 200 });
    expect(placed.rightInset).toBeGreaterThanOrEqual(0);
  });
});
