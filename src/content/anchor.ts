export type Placement = "above" | "below";

export interface Rect {
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
  readonly left: number;
  readonly width: number;
  readonly height: number;
}

export interface Viewport {
  readonly width: number;
  readonly height: number;
}

export interface PanelPlacement {
  readonly placement: Placement;
  readonly rightInset: number;
  readonly bottomInset: number;
  readonly maxWidth: number;
}

export const PANEL_MAX_WIDTH = 360;
export const PANEL_GAP = 6;
const VIEWPORT_MARGIN = 12;

function clamp(value: number, lowest: number, highest: number): number {
  return Math.min(Math.max(value, lowest), highest);
}

/**
 * The panel hangs off the anchor's right edge and grows leftwards, so both offsets are insets from
 * the viewport's right and bottom edges, matching the fixed-position host the chip already uses.
 */
export function placePanel(anchor: Rect, panelHeight: number, viewport: Viewport): PanelPlacement {
  const roomAbove = anchor.top - VIEWPORT_MARGIN;
  const roomBelow = viewport.height - anchor.bottom - VIEWPORT_MARGIN;
  const neededHeight = panelHeight + PANEL_GAP;
  const placement: Placement = roomAbove >= neededHeight || roomAbove >= roomBelow ? "above" : "below";

  const maxWidth = Math.max(Math.min(PANEL_MAX_WIDTH, viewport.width - VIEWPORT_MARGIN * 2), 0);
  const widestRightInset = Math.max(viewport.width - maxWidth - VIEWPORT_MARGIN, VIEWPORT_MARGIN);
  const rightInset = clamp(viewport.width - anchor.right, VIEWPORT_MARGIN, widestRightInset);

  const bottomInset =
    placement === "above"
      ? viewport.height - anchor.top + PANEL_GAP
      : viewport.height - anchor.bottom - PANEL_GAP - panelHeight;

  return {
    placement,
    rightInset,
    bottomInset: Math.max(bottomInset, VIEWPORT_MARGIN),
    maxWidth,
  };
}

export const CHIP_SIZE = 28;
export const RAIL_ITEM_SIZE = 26;
export const RAIL_GAP = 2;
export const STRIP_OFFSET = 5;
export const WINDOW_WIDTH = 280;
export const WINDOW_HEIGHT = 148;

/** The rail is a fixed 28px-wide capsule; only its height grows with the item count. */
export function placeRail(chipRect: Rect, itemCount: number, viewport: Viewport): PanelPlacement {
  const height = itemCount * RAIL_ITEM_SIZE + Math.max(itemCount - 1, 0) * RAIL_GAP;
  const placed = placePanel(chipRect, height, viewport);
  return { ...placed, maxWidth: CHIP_SIZE };
}

/** The result window is a fixed 280x148px panel in every state; height never varies. */
export function placeWindow(chipRect: Rect, viewport: Viewport): PanelPlacement {
  const placed = placePanel(chipRect, WINDOW_HEIGHT, viewport);
  return { ...placed, maxWidth: WINDOW_WIDTH };
}

export interface StripPlacement {
  readonly rightInset: number;
  readonly topInset: number;
  readonly width: number;
}

/** The sub-option strip sits to the left of the rail item that owns it, top-aligned with it. */
export function placeStrip(railItemRect: Rect, subCount: number, viewport: Viewport): StripPlacement {
  const width = subCount * RAIL_ITEM_SIZE + Math.max(subCount - 1, 0) * RAIL_GAP;
  const rightInset = Math.max(viewport.width - railItemRect.left + STRIP_OFFSET, 0);
  const topInset = Math.max(railItemRect.top, 0);
  return { rightInset, topInset, width };
}
