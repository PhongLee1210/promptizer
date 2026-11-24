import { browser } from "wxt/browser";

const STORAGE_KEY = "popupState";

interface StoredPopupState {
  readonly globalEnabled?: boolean;
}

export async function isGloballyEnabled(): Promise<boolean> {
  const stored = await browser.storage.local.get(STORAGE_KEY);
  const state = stored[STORAGE_KEY] as StoredPopupState | undefined;
  return state?.globalEnabled ?? true;
}

export async function disableGlobally(): Promise<void> {
  const stored = await browser.storage.local.get(STORAGE_KEY);
  const state = (stored[STORAGE_KEY] as Record<string, unknown> | undefined) ?? {};
  await browser.storage.local.set({ [STORAGE_KEY]: { ...state, globalEnabled: false } });
}

export function onGlobalEnabledChanged(callback: (enabled: boolean) => void): () => void {
  const listener = (changes: Record<string, { newValue?: unknown }>, areaName: string) => {
    if (areaName !== "local") {
      return;
    }
    const change = changes[STORAGE_KEY];
    if (change === undefined) {
      return;
    }
    const next = change.newValue as StoredPopupState | undefined;
    callback(next?.globalEnabled ?? true);
  };
  browser.storage.onChanged.addListener(listener);
  return () => browser.storage.onChanged.removeListener(listener);
}
