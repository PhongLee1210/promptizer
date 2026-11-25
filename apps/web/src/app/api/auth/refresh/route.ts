import { refreshSession } from "../../../../lib/server/accounts.ts";
import { readJsonBody } from "../../../../lib/server/http.ts";
import { UNAUTHENTICATED } from "../../../../lib/server/outcome.ts";
import { sessionResponse } from "../../../../lib/server/session-responses.ts";
import { readRefreshTokenCookie } from "../../../../lib/server/session-cookies.ts";

function readRefreshTokenFromBody(body: unknown): string | undefined {
  const value = typeof body === "object" && body !== null ? (body as Record<string, unknown>).refreshToken : undefined;
  return typeof value === "string" && value ? value : undefined;
}

export async function POST(request: Request): Promise<Response> {
  const refreshToken = readRefreshTokenFromBody(await readJsonBody(request)) ?? readRefreshTokenCookie(request);
  return sessionResponse(refreshToken ? await refreshSession(refreshToken) : UNAUTHENTICATED, 200);
}
