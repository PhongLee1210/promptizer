import type { AuthSession } from "@promptizer/shared";

export const ACCESS_COOKIE = "promptizer_access";
const REFRESH_COOKIE = "promptizer_refresh";
const REFRESH_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;
const BEARER_PREFIX = "Bearer ";

function serializeCookie(name: string, value: string, maxAgeSeconds: number, path: string): string {
  const attributes = [
    `${name}=${encodeURIComponent(value)}`,
    `Path=${path}`,
    `Max-Age=${maxAgeSeconds}`,
    "HttpOnly",
    "SameSite=Lax",
  ];
  if (process.env.NODE_ENV === "production") {
    attributes.push("Secure");
  }
  return attributes.join("; ");
}

function readCookie(request: Request, name: string): string | undefined {
  const header = request.headers.get("cookie");
  if (!header) {
    return undefined;
  }
  for (const part of header.split(";")) {
    const separatorIndex = part.indexOf("=");
    if (part.slice(0, separatorIndex).trim() === name) {
      return decodeURIComponent(part.slice(separatorIndex + 1).trim());
    }
  }
  return undefined;
}

export function buildSessionCookies(session: AuthSession): string[] {
  const accessMaxAge = Math.max(session.expiresAt - Math.floor(Date.now() / 1000), 0);
  return [
    serializeCookie(ACCESS_COOKIE, session.accessToken, accessMaxAge, "/"),
    serializeCookie(REFRESH_COOKIE, session.refreshToken, REFRESH_COOKIE_MAX_AGE_SECONDS, "/api/auth"),
  ];
}

export function buildClearedSessionCookies(): string[] {
  return [serializeCookie(ACCESS_COOKIE, "", 0, "/"), serializeCookie(REFRESH_COOKIE, "", 0, "/api/auth")];
}

export function readAccessToken(request: Request): string | undefined {
  const authorization = request.headers.get("authorization");
  if (authorization?.startsWith(BEARER_PREFIX)) {
    return authorization.slice(BEARER_PREFIX.length).trim() || undefined;
  }
  return readCookie(request, ACCESS_COOKIE);
}

export function readRefreshTokenCookie(request: Request): string | undefined {
  return readCookie(request, REFRESH_COOKIE);
}
