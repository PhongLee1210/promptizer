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
  confirmedUser(): Promise<AuthUser | undefined>;
  getAccessToken(): Promise<AuthClientResult<string | undefined>>;
}

function isExpiringSoon(session: AuthSession, nowSeconds: number): boolean {
  return session.expiresAt - nowSeconds <= RENEW_BEFORE_EXPIRY_SECONDS;
}

export function createSessionManager(
  client: AuthClient,
  store: SessionStore,
  now: () => number = () => Date.now(),
  wipeAccountData: () => Promise<void> = async () => {},
): SessionManager {
  let credentialChangeCount = 0;

  async function clearCredentials(): Promise<void> {
    credentialChangeCount += 1;
    await store.clear();
    await wipeAccountData();
  }

  async function renew(session: AuthSession): Promise<AuthClientResult<AuthSession | undefined>> {
    const credentialChangeCountAtStart = credentialChangeCount;
    const renewed = await client.refresh(session.refreshToken);
    if (credentialChangeCount !== credentialChangeCountAtStart) {
      return { ok: true, value: await store.load() };
    }
    if (renewed.ok) {
      await store.save(renewed.value);
      return renewed;
    }
    if (renewed.error.kind !== "retryable") {
      await clearCredentials();
      return { ok: true, value: undefined };
    }
    return renewed;
  }

  async function getAccessToken(): Promise<AuthClientResult<string | undefined>> {
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
  }

  return {
    async signIn(email, password) {
      const result = await client.signIn(email, password);
      if (!result.ok) {
        return result;
      }
      credentialChangeCount += 1;
      await wipeAccountData();
      await store.save(result.value);
      return { ok: true, value: result.value.user };
    },

    async signOut() {
      const session = await store.load();
      await clearCredentials();
      if (session) {
        await client.signOut(session.accessToken);
      }
    },

    async currentUser() {
      return (await store.load())?.user;
    },

    getAccessToken,

    async confirmedUser() {
      const stored = await store.load();
      const token = await getAccessToken();
      if (!token.ok) {
        return stored?.user;
      }
      if (token.value === undefined) {
        return undefined;
      }
      const confirmation = await client.me(token.value);
      if (confirmation.ok) {
        return confirmation.value;
      }
      if (confirmation.error.kind !== "unauthenticated") {
        return stored?.user;
      }
      const current = await store.load();
      const renewed = current ? await renew(current) : undefined;
      return renewed?.ok ? renewed.value?.user : stored?.user;
    },
  };
}
