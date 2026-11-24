import { describe, expect, it } from "vitest";
import { icon, icons } from "../icons";
import { BUILTIN_PLATFORMS } from "../../popup/platforms";

const shippedIconCount = 57;

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
    expect(icons).toHaveProperty("grammar");
    expect(icons).toHaveProperty("clock");
    expect(icons).toHaveProperty("tweak");
    expect(icons).toHaveProperty("replace");
    expect(icons).toHaveProperty("back");
    expect(icons).toHaveProperty("fwd");
  });

  it("ships a currentColor logo for every built-in platform", () => {
    for (const platform of BUILTIN_PLATFORMS) {
      expect(icons[platform.logo]).toContain('fill="currentColor"');
    }
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
