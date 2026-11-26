import assert from "node:assert/strict";
import { test } from "node:test";
import { classifyDevice, isMobileSplitRoute } from "../src/lib/device.ts";

const MOBILE_USER_AGENTS = [
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
  "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Mobile Safari/537.36",
  "Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Mobile Safari/537.36",
  "Mozilla/5.0 (iPod touch; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1",
  "Opera/9.80 (Android; Opera Mini/12.0) Presto/2.12",
];

const DESKTOP_USER_AGENTS = [
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:126.0) Gecko/20100101 Firefox/126.0",
  "Mozilla/5.0 (iPad; CPU OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/604.1",
  "Mozilla/5.0 (Linux; Android 13; SM-X710) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
];

test("phone user agents classify as mobile", () => {
  for (const userAgent of MOBILE_USER_AGENTS) {
    assert.equal(classifyDevice(userAgent), "mobile", userAgent);
  }
});

test("desktop, tablet and missing user agents classify as desktop", () => {
  for (const userAgent of DESKTOP_USER_AGENTS) {
    assert.equal(classifyDevice(userAgent), "desktop", userAgent);
  }
  assert.equal(classifyDevice(null), "desktop");
});

test("only registered routes are rewritten for mobile", () => {
  for (const route of ["/", "/prompts", "/prompts/new", "/account/password"]) {
    assert.equal(isMobileSplitRoute(route), true, route);
  }
  for (const route of ["/sign-in", "/sign-up", "/packs", "/m/prompts", "/prompts/unknown", "/api/auth/me"]) {
    assert.equal(isMobileSplitRoute(route), false, route);
  }
});
