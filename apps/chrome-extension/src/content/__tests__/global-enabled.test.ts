import { afterEach, describe, expect, it } from "vitest";
import { fakeBrowser } from "wxt/testing/fake-browser";
import { disableGlobally, isGloballyEnabled, onGlobalEnabledChanged } from "../global-enabled";

describe("global-enabled", () => {
  afterEach(() => {
    fakeBrowser.reset();
  });

  it("defaults to enabled when nothing is stored", async () => {
    expect(await isGloballyEnabled()).toBe(true);
  });

  it("reads the stored globalEnabled flag", async () => {
    await fakeBrowser.storage.local.set({ popupState: { globalEnabled: false } });
    expect(await isGloballyEnabled()).toBe(false);
  });

  it("disables globally while preserving the rest of the stored popup state", async () => {
    await fakeBrowser.storage.local.set({ popupState: { globalEnabled: true, switchTimeoutSeconds: 5 } });
    await disableGlobally();
    const stored = await fakeBrowser.storage.local.get("popupState");
    expect(stored.popupState).toEqual({ globalEnabled: false, switchTimeoutSeconds: 5 });
  });

  it("notifies listeners when the stored flag changes", async () => {
    const seen: boolean[] = [];
    const unsubscribe = onGlobalEnabledChanged((enabled) => seen.push(enabled));

    await fakeBrowser.storage.local.set({ popupState: { globalEnabled: false } });
    await fakeBrowser.storage.local.set({ popupState: { globalEnabled: true } });

    expect(seen).toEqual([false, true]);
    unsubscribe();
  });

  it("stops notifying after unsubscribe", async () => {
    const seen: boolean[] = [];
    const unsubscribe = onGlobalEnabledChanged((enabled) => seen.push(enabled));
    unsubscribe();

    await fakeBrowser.storage.local.set({ popupState: { globalEnabled: false } });

    expect(seen).toEqual([]);
  });
});
