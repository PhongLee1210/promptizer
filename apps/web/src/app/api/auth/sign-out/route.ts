import { endSession } from "../../../../lib/server/accounts.ts";
import { emptyResponse } from "../../../../lib/server/http.ts";
import { buildClearedSessionCookies, readAccessToken } from "../../../../lib/server/session-cookies.ts";

export async function POST(request: Request): Promise<Response> {
  const accessToken = readAccessToken(request);
  if (accessToken) {
    await endSession(accessToken);
  }
  return emptyResponse(buildClearedSessionCookies());
}
