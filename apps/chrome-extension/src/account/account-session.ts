import { library } from "../library/library.ts";
import { clearFirstSaveNotice } from "../prompts/first-save-notice.ts";
import { API_ORIGIN } from "./api-origin.ts";
import { createAuthClient } from "./auth-client.ts";
import { createSessionManager } from "./session-manager.ts";
import { createBrowserSessionStore } from "./session-store.ts";

export { API_ORIGIN };

export const accountSession = createSessionManager(
  createAuthClient(API_ORIGIN),
  createBrowserSessionStore(),
  () => Date.now(),
  () => Promise.all([library.wipe(), clearFirstSaveNotice()]).then(() => undefined),
);
