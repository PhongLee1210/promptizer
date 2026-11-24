import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  LOADING_STYLE,
  SLOW_OPERATION_HINT_MS,
  SlowHintTimer,
  applySettleIn,
  createBusyLabel,
  createProgressBar,
  createShimmerLines,
  createSlowHint,
  updateProgressBar,
} from "../loading-ui";

describe("createShimmerLines", () => {
  it("renders one line per width, in order", () => {
    const lines = createShimmerLines(["92%", "78%", "54%"]);
    const children = [...lines.children] as HTMLElement[];
    expect(children.map((child) => child.style.width)).toEqual(["92%", "78%", "54%"]);
    expect(lines.getAttribute("aria-hidden")).toBe("true");
  });
});

describe("createBusyLabel", () => {
  it("exposes the plain verb as its text", () => {
    expect(createBusyLabel("Refining").textContent).toBe("Refining");
  });
});

describe("createProgressBar", () => {
  it("is determinate with aria values and a fill scale when percent is above zero", () => {
    const bar = createProgressBar(42, "Downloading");
    expect(bar.getAttribute("role")).toBe("progressbar");
    expect(bar.getAttribute("aria-valuemin")).toBe("0");
    expect(bar.getAttribute("aria-valuemax")).toBe("100");
    expect(bar.getAttribute("aria-valuenow")).toBe("42");
    expect(bar.getAttribute("aria-label")).toBe("Downloading");
    expect(bar.querySelector(".pz-load__progress-pct")?.textContent).toBe("42%");
    expect(
      bar.querySelector<HTMLElement>(".pz-load__progress-fill")?.style.getPropertyValue("--pz-load-progress"),
    ).toBe("0.42");
  });

  it("is indeterminate at zero percent", () => {
    const bar = createProgressBar(0, "Downloading");
    expect(bar.hasAttribute("aria-valuenow")).toBe(false);
    expect(bar.querySelector(".pz-load__progress-pct")?.textContent).toBe("");
    expect(bar.querySelector<HTMLElement>(".pz-load__progress-fill")?.dataset.indeterminate).toBe("true");
  });
});

describe("progress clamping", () => {
  it.each([
    [-5, undefined],
    [Number.NaN, undefined],
    [140, "100"],
  ])("clamps %s when creating", (percent, expectedNow) => {
    const bar = createProgressBar(percent, "Downloading");
    expect(bar.getAttribute("aria-valuenow") ?? undefined).toBe(expectedNow);
    const fill = bar.querySelector<HTMLElement>(".pz-load__progress-fill")!;
    expect(fill.style.getPropertyValue("--pz-load-progress")).toBe(expectedNow === undefined ? "" : "1");
  });
});

describe("updateProgressBar", () => {
  it("updates the existing elements in place", () => {
    const bar = createProgressBar(10, "Downloading");
    const fill = bar.querySelector(".pz-load__progress-fill");
    expect(updateProgressBar(bar, 60)).toBe(true);
    expect(bar.querySelector(".pz-load__progress-fill")).toBe(fill);
    expect(bar.getAttribute("aria-valuenow")).toBe("60");
    expect(bar.querySelector(".pz-load__progress-pct")?.textContent).toBe("60%");
    expect((fill as HTMLElement).style.getPropertyValue("--pz-load-progress")).toBe("0.6");
  });

  it("reports that an indeterminate bar must be rebuilt", () => {
    const bar = createProgressBar(0, "Downloading");
    expect(updateProgressBar(bar, 30)).toBe(false);
    const rebuilt = createProgressBar(30, "Downloading");
    expect(rebuilt.hasAttribute("aria-valuenow")).toBe(true);
    expect(rebuilt.querySelector<HTMLElement>(".pz-load__progress-fill")?.dataset.indeterminate).toBeUndefined();
  });
});

describe("SlowHintTimer", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("fires once after the threshold", () => {
    const onSlow = vi.fn();
    const timer = new SlowHintTimer();
    timer.start(onSlow);
    vi.advanceTimersByTime(SLOW_OPERATION_HINT_MS - 1);
    expect(onSlow).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    vi.advanceTimersByTime(SLOW_OPERATION_HINT_MS * 3);
    expect(onSlow).toHaveBeenCalledTimes(1);
  });

  it("does not fire after cancel", () => {
    const onSlow = vi.fn();
    const timer = new SlowHintTimer();
    timer.start(onSlow);
    timer.cancel();
    vi.advanceTimersByTime(SLOW_OPERATION_HINT_MS * 2);
    expect(onSlow).not.toHaveBeenCalled();
  });
});
