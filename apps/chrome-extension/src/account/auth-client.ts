import type { AuthErrorBody, AuthFieldErrors, AuthSession } from "@promptizer/shared";

export type AuthClientError =
  | { kind: "invalid_credentials"; message: string }
  | { kind: "unauthenticated"; message: string }
  | { kind: "validation"; message: string; fields: AuthFieldErrors }
  | { kind: "retryable"; message: string };

export type AuthClientResult<Value> = { ok: true; value: Value } | { ok: false; error: AuthClientError };

export interface AuthClient {
  signIn(email: string, password: string): Promise<AuthClientResult<AuthSession>>;
  refresh(refreshToken: string): Promise<AuthClientResult<AuthSession>>;
  signOut(accessToken: string): Promise<AuthClientResult<null>>;
}

const RETRYABLE_ERROR: AuthClientError = {
  kind: "retryable",
  message: "Couldn't reach Promptizer. Check your connection and try again.",
};

function mapFailure(status: number, body: AuthErrorBody | undefined): AuthClientError {
  switch (body?.code) {
    case "invalid_credentials":
      return { kind: "invalid_credentials", message: body.message };
    case "unauthenticated":
      return { kind: "unauthenticated", message: body.message };
    case "rate_limited":
      return { kind: "retryable", message: body.message };
    case "validation_failed":
      return { kind: "validation", message: body.message, fields: body.fields ?? {} };
    default:
      return status === 401 ? { kind: "unauthenticated", message: "Please sign in again." } : RETRYABLE_ERROR;
  }
}

async function readErrorBody(response: Response): Promise<AuthErrorBody | undefined> {
  try {
    return (await response.json()) as AuthErrorBody;
  } catch {
    return undefined;
  }
}

export function createAuthClient(apiOrigin: string, fetchImplementation: typeof fetch = fetch): AuthClient {
  async function send<Value>(
    path: string,
    init: RequestInit,
    readValue: (response: Response) => Promise<Value>,
  ): Promise<AuthClientResult<Value>> {
    let response: Response;
    try {
      response = await fetchImplementation(`${apiOrigin}${path}`, { method: "POST", ...init });
    } catch {
      return { ok: false, error: RETRYABLE_ERROR };
    }
    if (!response.ok) {
      return { ok: false, error: mapFailure(response.status, await readErrorBody(response)) };
    }
    try {
      return { ok: true, value: await readValue(response) };
    } catch {
      return { ok: false, error: RETRYABLE_ERROR };
    }
  }

  const readSession = (response: Response) => response.json() as Promise<AuthSession>;
  const jsonHeaders = { "Content-Type": "application/json" };

  return {
    signIn: (email, password) =>
      send("/api/auth/sign-in", { headers: jsonHeaders, body: JSON.stringify({ email, password }) }, readSession),
    refresh: (refreshToken) =>
      send("/api/auth/refresh", { headers: jsonHeaders, body: JSON.stringify({ refreshToken }) }, readSession),
    signOut: (accessToken) =>
      send("/api/auth/sign-out", { headers: { Authorization: `Bearer ${accessToken}` } }, async () => null),
  };
}
