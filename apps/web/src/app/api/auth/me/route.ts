import { authenticate } from "@/lib/server/authenticate.ts";
import { failureResponse, jsonResponse } from "@/lib/server/http.ts";
import { clearedSessionCookiesFor } from "@/lib/server/session-cookies.ts";

export async function GET(request: Request): Promise<Response> {
  const caller = await authenticate(request);
  if (!caller.ok) {
    const isExpiredOrMissing = caller.failure.body.code === "unauthenticated";
    return failureResponse(caller.failure, isExpiredOrMissing ? clearedSessionCookiesFor(request) : []);
  }
  return jsonResponse(caller.value.user, 200);
}
