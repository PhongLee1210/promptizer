import type { AuthSession, AuthUser } from "@promptizer/shared";
import type { AuthClient, AuthClientError, AuthClientResult } from "./auth-client.ts";

const RENEW_BEFORE_EXPIRY_SECONDS = 60;

export interface SessionStore {
  load(): Promise<AuthSession | undefined>;
  save(session: AuthSession): Promise<void>;
  clear(): Promise<void>;
}

export interface SessionManager {
  signIn(email: string, password: string): Promise<AuthClientResult<AuthUser>>;
  signOut(): Promise<void>;
  currentUser(): Promise<AuthUser | undefined>;
  getAccessToken(): Promise<AuthClientResult<string | undefined>>;
}

function isExpiringSoon(session: AuthSession, nowSeconds: number): boolean {
  return session.expiresAt - nowSeconds <= RENEW_BEFORE_EXPIRY_SECONDS;
}

export function createSessionManager(
  client: AuthClient,
  store: SessionStore,
  now: () => number = () => Date.now(),
): SessionManager {
  async function renew(session: AuthSession): Promise<AuthClientResult<AuthSession | undefined>> {
    const renewed = await client.refresh(session.refreshToken);
    if (renewed.ok) {
      await store.save(renewed.value);
      return renewed;
    }
    if (renewed.error.kind !== "retryable") {
      await store.clear();
      return { ok: true, value: undefined };
    }
    return renewed;
  }

  return {
    async signIn(email, password) {
      const result = await client.signIn(email, password);
      if (!result.ok) {
        return result;
      }
      await store.save(result.value);
      return { ok: true, value: result.value.user };
    },

    async signOut() {
      const session = await store.load();
      await store.clear();
      if (session) {
        await client.signOut(session.accessToken);
      }
    },

    async currentUser() {
      return (await store.load())?.user;
    },

    async getAccessToken() {
      const session = await store.load();
      if (!session) {
        return { ok: true, value: undefined };
      }
      if (!isExpiringSoon(session, Math.floor(now() / 1000))) {
        return { ok: true, value: session.accessToken };
      }
      const renewed = await renew(session);
      if (!renewed.ok) {
        return renewed as { ok: false; error: AuthClientError };
      }
      return { ok: true, value: renewed.value?.accessToken };
    },
  };
}
