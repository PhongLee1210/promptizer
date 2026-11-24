import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { expect, it } from "vitest";
import { PRODUCT_NAME } from "@promptizer/shared";

it("resolves @promptizer/shared from the extension app", () => {
  expect(PRODUCT_NAME).toBe("Promptizer");
});

it("resolves @promptizer/ui tokens from the extension app", () => {
  const tokensCss = readFileSync(createRequire(import.meta.url).resolve("@promptizer/ui/tokens.css"), "utf8");
  expect(tokensCss).toContain("--pz-neutral-0");
});
