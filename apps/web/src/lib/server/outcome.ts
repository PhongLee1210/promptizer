import type { AuthErrorBody, AuthErrorCode, AuthFieldErrors } from "@promptizer/shared";

export interface Failure {
  status: number;
  body: AuthErrorBody;
}

export type Outcome<Value> = { ok: true; value: Value } | { ok: false; failure: Failure };

export function succeed<Value>(value: Value): Outcome<Value> {
  return { ok: true, value };
}

export function fail(
  status: number,
  code: AuthErrorCode,
  message: string,
  fields?: AuthFieldErrors,
): { ok: false; failure: Failure } {
  return { ok: false, failure: { status, body: fields ? { code, message, fields } : { code, message } } };
}

export const SERVICE_UNAVAILABLE = fail(502, "service_unavailable", "The service is unreachable. Please try again.");
export const UNAUTHENTICATED = fail(401, "unauthenticated", "Please sign in to continue.");
