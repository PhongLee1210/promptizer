import type { AuthUser } from "@promptizer/shared";
import { resolveUser } from "./accounts.ts";
import { UNAUTHENTICATED } from "./outcome.ts";
import type { Outcome } from "./outcome.ts";
import { readAccessToken } from "./session-cookies.ts";

export interface AuthenticatedCaller {
  accessToken: string;
  user: AuthUser;
}

export async function authenticate(request: Request): Promise<Outcome<AuthenticatedCaller>> {
  const accessToken = readAccessToken(request);
  if (!accessToken) {
    return UNAUTHENTICATED;
  }
  const resolved = await resolveUser(accessToken);
  return resolved.ok ? { ok: true, value: { accessToken, user: resolved.value } } : resolved;
}
