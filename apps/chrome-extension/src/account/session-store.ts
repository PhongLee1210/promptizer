import { browser } from "wxt/browser";
import type { AuthSession } from "@promptizer/shared";
import type { SessionStore } from "./session-manager.ts";

const SESSION_STORAGE_KEY = "promptizer.accountSession";
const SIGNED_IN_STORAGE_KEY = "promptizer.signedIn";

export async function hasStoredSession(): Promise<boolean> {
  const stored = await browser.storage.local.get(SIGNED_IN_STORAGE_KEY);
  return stored[SIGNED_IN_STORAGE_KEY] === true;
}

export function onStoredSessionChanged(callback: (signedIn: boolean) => void): () => void {
  const listener = (changes: Record<string, { newValue?: unknown }>, areaName: string) => {
    const change = changes[SIGNED_IN_STORAGE_KEY];
    if (areaName !== "local" || change === undefined) {
      return;
    }
    callback(change.newValue === true);
  };
  browser.storage.onChanged.addListener(listener);
  return () => browser.storage.onChanged.removeListener(listener);
}

export function createBrowserSessionStore(): SessionStore {
  return {
    async load() {
      const stored = await browser.storage.local.get(SESSION_STORAGE_KEY);
      return stored[SESSION_STORAGE_KEY] as AuthSession | undefined;
    },
    async save(session) {
      await browser.storage.local.set({ [SESSION_STORAGE_KEY]: session, [SIGNED_IN_STORAGE_KEY]: true });
    },
    async clear() {
      await browser.storage.local.remove([SESSION_STORAGE_KEY, SIGNED_IN_STORAGE_KEY]);
    },
  };
}
