import type { ModelSlot, NanoSetupStatus, PlatformEntry, PopupState } from "./state-types";

export type MainView =
  | { kind: "active"; slot: ModelSlot }
  | { kind: "paused" }
  | { kind: "site-off"; site: PlatformEntry }
  | { kind: "unsupported" }
  | { kind: "backup"; slot: ModelSlot; allSlots: ModelSlot[] }
  | { kind: "primary-unavailable"; primary: ModelSlot }
  | { kind: "nano-downloading"; percent: number }
  | { kind: "nano-setup"; status: NanoSetupStatus }
  | { kind: "all-failing" };

export const NANO_PROVIDER_ID = "gemini-nano";

function findPlatformEntry(state: PopupState, hostname: string): PlatformEntry | undefined {
  const normalized = hostname.toLowerCase();
  return state.platforms.find(
    (platform) => normalized === platform.hostname || normalized.endsWith(`.${platform.hostname}`),
  );
}

export function deriveMainView(state: PopupState, activeHostname: string | undefined): MainView {
  if (!state.globalEnabled) {
    return { kind: "paused" };
  }

  if (activeHostname !== undefined) {
    const site = findPlatformEntry(state, activeHostname);
    if (site === undefined) {
      return { kind: "unsupported" };
    }
    if (!site.enabled) {
      return { kind: "site-off", site };
    }
  }

  const [primary, ...rest] = state.modelOrder;
  if (primary === undefined) {
    return { kind: "all-failing" };
  }
  const readyBackup = rest.find((slot) => slot.status === "ready");
  if (primary.providerId === NANO_PROVIDER_ID && readyBackup === undefined) {
    if (state.nano.status === "downloading") {
      return { kind: "nano-downloading", percent: state.nano.percent };
    }
    if (state.nano.status === "needs-download" || state.nano.status === "unsupported") {
      return { kind: "nano-setup", status: state.nano.status };
    }
  }

  if (primary.status === "ready") {
    return { kind: "active", slot: primary };
  }

  if (readyBackup !== undefined) {
    return { kind: "backup", slot: readyBackup, allSlots: state.modelOrder };
  }

  if (rest.length === 0) {
    return { kind: "primary-unavailable", primary };
  }

  return { kind: "all-failing" };
}

export function countEnabledPlatforms(state: PopupState): { enabled: number; total: number } {
  return {
    enabled: state.platforms.filter((platform) => platform.enabled).length,
    total: state.platforms.length,
  };
}

export function countConnectedProviders(state: PopupState): number {
  return state.providers.filter((provider) => !provider.builtin && provider.status !== "not-connected").length;
}
