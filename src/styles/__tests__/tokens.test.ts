import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const stylesDir = resolve(__dirname, "..");
const tokensCss = readFileSync(resolve(stylesDir, "tokens.css"), "utf8");
const baseCss = readFileSync(resolve(stylesDir, "base.css"), "utf8");

const tokens: [string, string][] = [
  ["--pz-bg", "#14161A"],
  ["--pz-surface", "#1B1E24"],
  ["--pz-surface-inset", "#101216"],
  ["--pz-divider", "#23262D"],
  ["--pz-border-control", "#6E7582"],
  ["--pz-track-off", "#3A3F48"],
  ["--pz-text", "#E8EAED"],
  ["--pz-text-2", "#B4BAC4"],
  ["--pz-text-3", "#9AA0AA"],
  ["--pz-accent", "#4C8DFF"],
  ["--pz-on-accent", "#0B1220"],
  ["--pz-accent-tint", "#1B2233"],
  ["--pz-success", "#3FCF8E"],
  ["--pz-success-text", "#7FE0B3"],
  ["--pz-success-bg", "#16291F"],
  ["--pz-warning", "#F5C469"],
  ["--pz-warning-bg", "#2A2415"],
  ["--pz-danger", "#FF8A80"],
  ["--pz-danger-bg", "#2E1A1A"]
];

const typeClasses = [
  ".pz-title",
  ".pz-header",
  ".pz-body-strong",
  ".pz-body",
  ".pz-caption",
  ".pz-overline",
  ".pz-micro"
];

describe("tokens.css", () => {
  it.each(tokens)("declares %s as %s", (name, value) => {
    expect(tokensCss).toContain(`${name}: ${value};`);
  });

  it("declares all nineteen tokens", () => {
    expect(tokens).toHaveLength(19);
  });

  it("ships dark theme only", () => {
    expect(tokensCss).not.toContain("prefers-color-scheme: light");
    expect(baseCss).not.toContain("prefers-color-scheme: light");
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
    expect(baseCss).toContain("system-ui, sans-serif");
  });

  it("offers tabular numerals", () => {
    expect(baseCss).toContain("font-variant-numeric: tabular-nums;");
  });

  it("declares spacing and radius scales", () => {
    for (const step of ["4px", "8px", "12px", "16px", "24px"]) {
      expect(baseCss).toContain(`--pz-space-${parseInt(step, 10)}: ${step};`);
    }
    for (const radius of ["8px", "10px", "14px"]) {
      expect(baseCss).toContain(`--pz-radius-${parseInt(radius, 10)}: ${radius};`);
    }
    expect(baseCss).toContain("--pz-radius-full: 9999px;");
  });

  it("never declares a font size below 11px", () => {
    const remSizes = [...baseCss.matchAll(/font-size:\s*([\d.]+)rem/g)].map((m) =>
      Number(m[1]) * 16
    );
    for (const px of remSizes) {
      expect(px).toBeGreaterThanOrEqual(11);
    }
    for (const forbidden of ["font-size: 0.625rem", "font-size: 10px", "font-size: 9px", "font-size: 8px"]) {
      expect(baseCss).not.toContain(forbidden);
    }
  });

  it("rings focus with the accent at 2px and 2px offset", () => {
    expect(baseCss).toContain(":focus-visible");
    expect(baseCss).toContain("outline: 2px solid var(--pz-accent);");
    expect(baseCss).toContain("outline-offset: 2px;");
  });
});
