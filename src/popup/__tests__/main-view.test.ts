import { describe, expect, it } from "vitest";
import { countConnectedProviders, countEnabledPlatforms, deriveMainView } from "../main-view";
import { defaultPopupState } from "../state-types";
import { BUILTIN_PLATFORMS } from "../platforms";

function seededState() {
  const state = defaultPopupState();
  state.platforms = BUILTIN_PLATFORMS.map((platform) => ({
    id: platform.id,
    label: platform.label,
    hostname: platform.hostname,
    enabled: true,
    builtin: true,
  }));
  return state;
}

describe("deriveMainView", () => {
  it("is active when the primary model is ready and the site is on", () => {
    const view = deriveMainView(seededState(), "claude.ai");
    expect(view.kind).toBe("active");
  });

  it("is paused when the global toggle is off, before checking the site", () => {
    const state = seededState();
    state.globalEnabled = false;
    expect(deriveMainView(state, "claude.ai").kind).toBe("paused");
  });

  it("is site-off when only that platform's toggle is off", () => {
    const state = seededState();
    state.platforms.find((p) => p.id === "claude")!.enabled = false;
    const view = deriveMainView(state, "claude.ai");
    expect(view.kind).toBe("site-off");
  });

  it("is unsupported on a hostname with no matching platform", () => {
    expect(deriveMainView(seededState(), "example.com").kind).toBe("unsupported");
  });

  it("is backup when the primary is unavailable and a later slot is ready", () => {
    const state = seededState();
    state.modelOrder = [
      {
        providerId: "gemini-nano",
        providerLabel: "On-device",
        modelName: "Gemini Nano",
        device: "on-device",
        status: "unavailable",
      },
      {
        providerId: "anthropic",
        providerLabel: "Anthropic",
        modelName: "Claude Haiku",
        device: "cloud",
        status: "ready",
      },
    ];
    const view = deriveMainView(state, "claude.ai");
    expect(view.kind).toBe("backup");
    expect(view.kind === "backup" && view.slot.modelName).toBe("Claude Haiku");
  });

  it("is primary-unavailable when there is no backup slot at all", () => {
    const state = seededState();
    state.modelOrder = [
      {
        providerId: "gemini-nano",
        providerLabel: "On-device",
        modelName: "Gemini Nano",
        device: "on-device",
        status: "unavailable",
      },
    ];
    expect(deriveMainView(state, "claude.ai").kind).toBe("primary-unavailable");
  });

  it("is all-failing when every configured slot has failed", () => {
    const state = seededState();
    state.modelOrder = [
      {
        providerId: "gemini-nano",
        providerLabel: "On-device",
        modelName: "Gemini Nano",
        device: "on-device",
        status: "unavailable",
      },
      {
        providerId: "anthropic",
        providerLabel: "Anthropic",
        modelName: "Claude Haiku",
        device: "cloud",
        status: "error",
      },
    ];
    expect(deriveMainView(state, "claude.ai").kind).toBe("all-failing");
  });

  it("ignores the active site entirely when no hostname is known", () => {
    const state = seededState();
    state.platforms.forEach((p) => (p.enabled = false));
    expect(deriveMainView(state, undefined).kind).toBe("active");
  });
});

describe("countEnabledPlatforms", () => {
  it("counts enabled against total", () => {
    const state = seededState();
    state.platforms[0]!.enabled = false;
    expect(countEnabledPlatforms(state)).toEqual({
      enabled: BUILTIN_PLATFORMS.length - 1,
      total: BUILTIN_PLATFORMS.length,
    });
  });
});

describe("countConnectedProviders", () => {
  it("excludes the builtin Gemini Nano provider", () => {
    const state = seededState();
    expect(countConnectedProviders(state)).toBe(0);
    state.providers.find((p) => p.id === "anthropic")!.status = "connected";
    expect(countConnectedProviders(state)).toBe(1);
  });
});
