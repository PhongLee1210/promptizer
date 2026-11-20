import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const stylesDir = resolve(__dirname, "..");
const tokensCss = readFileSync(resolve(stylesDir, "tokens.css"), "utf8");
const baseCss = readFileSync(resolve(stylesDir, "base.css"), "utf8");
const statesCss = readFileSync(resolve(stylesDir, "states.css"), "utf8");
const popupCss = readFileSync(resolve(stylesDir, "popup.css"), "utf8");
const chipTs = readFileSync(resolve(stylesDir, "..", "content", "chip.ts"), "utf8");
const railTs = readFileSync(resolve(stylesDir, "..", "content", "rail.ts"), "utf8");
const windowTs = readFileSync(resolve(stylesDir, "..", "content", "result-window.ts"), "utf8");

const primitives: [string, string][] = [
  ["--pz-blue-20", "#6FA3FF"],
  ["--pz-blue-40", "#4C8DFF"],
  ["--pz-blue-90", "#1B2233"],
  ["--pz-blue-100", "#0B1220"],
  ["--pz-green-20", "#7FE0B3"],
  ["--pz-green-40", "#3FCF8E"],
  ["--pz-green-100", "#16291F"],
  ["--pz-neutral-0", "#E8EAED"],
  ["--pz-neutral-10", "#B4BAC4"],
  ["--pz-neutral-20", "#9AA0AA"],
  ["--pz-neutral-30", "#6E7582"],
  ["--pz-neutral-40", "#4A505A"],
  ["--pz-neutral-60", "#3A3F48"],
  ["--pz-neutral-80", "#30353E"],
  ["--pz-neutral-85", "#262A31"],
  ["--pz-neutral-90", "#23262D"],
  ["--pz-neutral-95", "#1B1E24"],
  ["--pz-neutral-97", "#14161A"],
  ["--pz-neutral-100", "#101216"],
  ["--pz-red-30", "#FF8A80"],
  ["--pz-red-100", "#2E1A1A"],
  ["--pz-yellow-30", "#F5C469"],
  ["--pz-yellow-100", "#2A2415"],
];

const semanticFamilies = ["background", "border", "button", "fill", "text"];

const typeClasses = [
  ".pz-title",
  ".pz-header",
  ".pz-body-strong",
  ".pz-body",
  ".pz-caption",
  ".pz-overline",
  ".pz-micro",
];

const componentSheets: [string, string][] = [
  ["popup.css", popupCss],
  ["chip.ts", chipTs],
  ["rail.ts", railTs],
  ["result-window.ts", windowTs],
];

describe("tokens.css", () => {
  it.each(primitives)("declares the primitive %s as %s", (name, value) => {
    expect(tokensCss.toLowerCase()).toContain(`${name}: ${value.toLowerCase()};`);
  });

  it("resolves every semantic colour through a primitive, never a raw literal", () => {
    const semantics = [...tokensCss.matchAll(/--pz-color-[\w-]+:\s*([^;]+);/g)].map((match) => match[1]);
    expect(semantics.length).toBeGreaterThan(0);
    for (const value of semantics) {
      expect(value).toMatch(/^var\(--pz-[\w-]+\)$/);
    }
  });

  it.each(semanticFamilies)("groups %s colours under one semantic family", (family) => {
    expect(tokensCss).toContain(`--pz-color-${family}-`);
  });

  it("exposes the base and dark blocks to shadow roots as well as the document", () => {
    expect([...tokensCss.matchAll(/:where\(:root, :host\)/g)].length).toBeGreaterThanOrEqual(2);
    expect(tokensCss).toContain('[data-pz-mode="dark"]');
  });

  it("ships dark only", () => {
    expect(tokensCss).not.toContain("prefers-color-scheme: light");
    expect(baseCss).not.toContain("prefers-color-scheme: light");
    expect(tokensCss).toContain("color-scheme: dark;");
  });

  it("declares the spacing, radius and control-size scales", () => {
    for (const [step, value] of [
      ["1", "4px"],
      ["2", "8px"],
      ["3", "12px"],
      ["4", "16px"],
      ["6", "24px"],
    ]) {
      expect(tokensCss).toContain(`--pz-space-${step}: ${value};`);
    }
    for (const [name, value] of [
      ["small", "8px"],
      ["medium", "10px"],
      ["large", "14px"],
      ["full", "9999px"],
    ]) {
      expect(tokensCss).toContain(`--pz-radius-${name}: ${value};`);
    }
    expect(tokensCss).toContain("--pz-size-control-xlarge: 44px;");
  });

  it("never declares a font size below 11px", () => {
    const sizes = [...tokensCss.matchAll(/--pz-(?:text|heading)-size-[\w-]+:\s*(\d+)px;/g)].map((m) => Number(m[1]));
    expect(sizes.length).toBeGreaterThan(0);
    for (const px of sizes) {
      expect(px).toBeGreaterThanOrEqual(11);
    }
  });
});

describe("component stylesheets", () => {
  it.each(componentSheets)("%s holds no colour literal of its own", (_name, css) => {
    expect(css).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(css).not.toMatch(/rgba?\(/);
  });
});

describe("base.css", () => {
  it("honours reduced motion", () => {
    expect(baseCss).toContain("prefers-reduced-motion: reduce");
  });

  it.each(typeClasses)("defines %s", (selector) => {
    expect(baseCss).toContain(selector);
  });

  it("bundles Inter with a swap display and a system fallback", () => {
    expect(baseCss).toContain("@font-face");
    expect(baseCss).toContain("../assets/fonts/inter-latin.woff2");
    expect(baseCss).toContain("font-display: swap;");
    expect(tokensCss).toContain("system-ui, -apple-system");
  });

  it("offers tabular numerals", () => {
    expect(baseCss).toContain("font-variant-numeric: tabular-nums;");
  });

  it("draws no focus ring and no hover layer on controls", () => {
    expect(baseCss).toContain(":focus-visible");
    expect(baseCss).not.toContain("outline: 2px solid");
    expect(statesCss).not.toContain(":hover");
  });
});
