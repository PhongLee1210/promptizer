import { describe, expect, it } from "vitest";
import { icon, icons } from "../icons";

const shippedIconCount = 39;

describe("icons", () => {
  it("inlines every shipped icon with currentColor preserved", () => {
    expect(Object.keys(icons)).toHaveLength(shippedIconCount);
    expect(icons.power).toContain('stroke="currentColor"');
    expect(icons.power).not.toMatch(/\swidth="24"/);
    expect(icons.power).toContain('aria-hidden="true"');
    expect(icon("power", 30)).toContain('width="30"');
    expect(icon("power")).toContain('width="24"');
  });

  it("exposes every name the asset manifest lists", () => {
    expect(icons).toHaveProperty("drag-handle");
    expect(icons).toHaveProperty("eye-off");
    expect(icons).toHaveProperty("sliders");
    expect(icons).toHaveProperty("wand");
    expect(icons).toHaveProperty("chip-gap");
  });

  it("leaves the fixed-colour in-page badge out of the inline map", () => {
    expect(icons).not.toHaveProperty("badge");
  });

  it("keeps the 24x24 viewBox on every icon", () => {
    for (const markup of Object.values(icons)) {
      expect(markup).toContain('viewBox="0 0 24 24"');
    }
  });
});
