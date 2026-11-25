import assert from "node:assert/strict";
import { test } from "node:test";
import { safeDestination, signInUrlFor } from "../src/lib/safe-redirect.ts";

test("deep links on the same origin are kept", () => {
  assert.equal(safeDestination("/account/password?tab=1"), "/account/password?tab=1");
});

test("external, protocol-relative and missing destinations fall back to home", () => {
  for (const candidate of ["https://evil.test", "//evil.test", "/\\evil.test", undefined, ["/a", "/b"]]) {
    assert.equal(safeDestination(candidate), "/");
  }
});

test("sign-in url carries the original destination", () => {
  assert.equal(signInUrlFor("/account/password"), "/sign-in?next=%2Faccount%2Fpassword");
});
