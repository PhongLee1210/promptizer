import { createAuthClient } from "./auth-client.ts";
import { createSessionManager } from "./session-manager.ts";
import { createBrowserSessionStore } from "./session-store.ts";

export const API_ORIGIN = import.meta.env.WXT_API_ORIGIN ?? "http://localhost:3000";

export const accountSession = createSessionManager(createAuthClient(API_ORIGIN), createBrowserSessionStore());
