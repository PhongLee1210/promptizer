import { expect, it } from "vitest";
import { PRODUCT_NAME } from "@promptizer/shared";

it("resolves @promptizer/shared from the extension app", () => {
  expect(PRODUCT_NAME).toBe("Promptizer");
});
