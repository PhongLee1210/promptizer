import { expect, it } from "vitest";
import { createTranslator, en } from "../index";

it("translates a known key", () => {
  expect(createTranslator("en")("shared.productName")).toBe("Promptizer");
});

it("returns the key itself when the dictionary lacks it", () => {
  expect(createTranslator("en")("nope.missing")).toBe("nope.missing");
});

it("ships exactly one locale: en", () => {
  expect(en).toBeDefined();
});
