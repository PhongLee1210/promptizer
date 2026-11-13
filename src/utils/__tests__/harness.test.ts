import { describe, it, expect, beforeEach } from "vitest";
import { fakeBrowser } from "wxt/testing/fake-browser";

describe("test harness", () => {
  beforeEach(() => {
    fakeBrowser.reset();
  });

  it("provides an in-memory extension storage", async () => {
    await fakeBrowser.storage.local.set({ probe: 1 });
    const stored = await fakeBrowser.storage.local.get("probe");
    expect(stored.probe).toBe(1);
  });

  it("provides a DOM", () => {
    const el = document.createElement("button");
    el.textContent = "Refine draft";
    expect(el.textContent).toBe("Refine draft");
  });
});
