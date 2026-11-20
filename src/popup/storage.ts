import { browser } from "wxt/browser";
import { BUILTIN_PLATFORMS } from "./platforms";
import { defaultPopupState, STORAGE_SCHEMA, type PopupState } from "./state-types";

const STORAGE_KEY = "popupState";
const CACHE_KEY = "promptizer.popupState";

function seedPlatforms(state: PopupState): PopupState {
  if (state.platforms.length > 0) {
    return state;
  }
  return {
    ...state,
    platforms: BUILTIN_PLATFORMS.map((platform) => ({
      id: platform.id,
      label: platform.label,
      hostname: platform.hostname,
      enabled: true,
      builtin: true,
    })),
  };
}

function migrate(stored: Partial<PopupState> | undefined): PopupState {
  const defaults = defaultPopupState();
  if (stored === undefined) {
    return defaults;
  }
  return {
    ...defaults,
    ...stored,
    schema: STORAGE_SCHEMA,
    suggest: {
      ...defaults.suggest,
      ...stored.suggest,
      categories: { ...defaults.suggest.categories, ...stored.suggest?.categories },
    },
    railCollapsed: stored.railCollapsed ?? defaults.railCollapsed,
    nano: { ...defaults.nano, ...stored.nano },
  };
}

export function readCachedState(): PopupState | undefined {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw === null ? undefined : migrate(JSON.parse(raw) as Partial<PopupState>);
  } catch {
    return undefined;
  }
}

function writeCachedState(state: PopupState): void {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(state));
  } catch {
    return;
  }
}

export async function loadPopupState(): Promise<PopupState> {
  const stored = await browser.storage.local.get(STORAGE_KEY);
  const existing = stored[STORAGE_KEY] as Partial<PopupState> | undefined;
  const state = seedPlatforms(migrate(existing));
  if (existing?.schema !== STORAGE_SCHEMA || existing.platforms?.length === 0) {
    await savePopupState(state);
  } else {
    writeCachedState(state);
  }
  return state;
}

export async function savePopupState(state: PopupState): Promise<void> {
  writeCachedState(state);
  await browser.storage.local.set({ [STORAGE_KEY]: state });
}

export function onPopupStateChanged(callback: (state: PopupState) => void): () => void {
  const listener = (changes: Record<string, { newValue?: unknown; oldValue?: unknown }>, areaName: string) => {
    if (areaName !== "local") {
      return;
    }
    const change = changes[STORAGE_KEY];
    if (change !== undefined) {
      callback(migrate(change.newValue as Partial<PopupState> | undefined));
    }
  };
  browser.storage.onChanged.addListener(listener);
  return () => browser.storage.onChanged.removeListener(listener);
}

export async function getActiveTabHostname(): Promise<string | undefined> {
  try {
    const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
    if (tab?.url === undefined) {
      return undefined;
    }
    return new URL(tab.url).hostname;
  } catch {
    return undefined;
  }
}
