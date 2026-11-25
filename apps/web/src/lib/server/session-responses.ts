import type { AuthSession } from "@promptizer/shared";
import { failureResponse, jsonResponse } from "./http.ts";
import type { Outcome } from "./outcome.ts";
import { buildClearedSessionCookies, buildSessionCookies } from "./session-cookies.ts";

export function sessionResponse(outcome: Outcome<AuthSession>, successStatus: number): Response {
  if (outcome.ok) {
    return jsonResponse(outcome.value, successStatus, buildSessionCookies(outcome.value));
  }
  const clearStaleSession = outcome.failure.body.code === "unauthenticated";
  return failureResponse(outcome.failure, clearStaleSession ? buildClearedSessionCookies() : []);
}
