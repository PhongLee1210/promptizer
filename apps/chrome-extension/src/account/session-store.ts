import { browser } from "wxt/browser";
import type { AuthSession } from "@promptizer/shared";
import type { SessionStore } from "./session-manager.ts";

const SESSION_STORAGE_KEY = "promptizer.accountSession";

export function createBrowserSessionStore(): SessionStore {
  return {
    async load() {
      const stored = await browser.storage.local.get(SESSION_STORAGE_KEY);
      return stored[SESSION_STORAGE_KEY] as AuthSession | undefined;
    },
    async save(session) {
      await browser.storage.local.set({ [SESSION_STORAGE_KEY]: session });
    },
    async clear() {
      await browser.storage.local.remove(SESSION_STORAGE_KEY);
    },
  };
}
