import type { ApiErrorBody, Prompt, PromptChanges, PromptDraft, PromptFieldErrors } from "@promptizer/shared";
import { UNREACHABLE_SAVE_MESSAGE } from "./auto-save.ts";
import type { SaveResult } from "./auto-save.ts";

export type PromptRequestFailureKind = "validation" | "unauthenticated" | "not_found" | "network" | "server";

export type PromptRequestResult =
  | { ok: true; prompt?: Prompt }
  | { ok: false; kind: PromptRequestFailureKind; message: string; fields?: PromptFieldErrors };

export type FetchFunction = (input: string, init: RequestInit) => Promise<Response>;

export const KEEPALIVE_BODY_LIMIT_BYTES = 60_000;
export const DELETED_PROMPT_MESSAGE = "This prompt was deleted.";

const PROMPTS_ENDPOINT = "/api/prompts";
const SERVER_FAILURE_MESSAGE = "Something went wrong. Please try again.";
const textEncoder = new TextEncoder();
const browserFetch: FetchFunction = (input, init) => fetch(input, init);

function failureKindFor(status: number, body: ApiErrorBody | undefined): PromptRequestFailureKind {
  if (status === 401 || body?.code === "unauthenticated") return "unauthenticated";
  if (status === 404 || body?.code === "not_found") return "not_found";
  if (status === 422 || body?.code === "validation_failed") return "validation";
  return "server";
}

async function sendPromptRequest(
  fetchFunction: FetchFunction,
  path: string,
  init: RequestInit,
): Promise<PromptRequestResult> {
  let response: Response;
  try {
    response = await fetchFunction(path, { credentials: "same-origin", ...init });
  } catch {
    return { ok: false, kind: "network", message: UNREACHABLE_SAVE_MESSAGE };
  }
  if (response.status === 204) {
    return { ok: true };
  }
  const body = (await response.json().catch(() => undefined)) as Prompt | ApiErrorBody | undefined;
  if (response.ok) {
    return { ok: true, prompt: body as Prompt };
  }
  const errorBody = body as ApiErrorBody | undefined;
  return {
    ok: false,
    kind: failureKindFor(response.status, errorBody),
    message: errorBody?.message ?? SERVER_FAILURE_MESSAGE,
    fields: errorBody?.fields as PromptFieldErrors | undefined,
  };
}

function jsonInit(method: string, payload: unknown, keepalive = false): RequestInit {
  const body = JSON.stringify(payload);
  return {
    method,
    headers: { "Content-Type": "application/json" },
    body,
    keepalive: keepalive && textEncoder.encode(body).length <= KEEPALIVE_BODY_LIMIT_BYTES,
  };
}

export function createPromptRequest(draft: PromptDraft, fetchFunction: FetchFunction = browserFetch) {
  return sendPromptRequest(fetchFunction, PROMPTS_ENDPOINT, jsonInit("POST", draft));
}

export function savePromptRequest(
  id: string,
  changes: PromptChanges,
  { keepalive }: { keepalive: boolean },
  fetchFunction: FetchFunction = browserFetch,
) {
  return sendPromptRequest(
    fetchFunction,
    `${PROMPTS_ENDPOINT}/${encodeURIComponent(id)}`,
    jsonInit("PATCH", changes, keepalive),
  );
}

export function deletePromptRequest(id: string, fetchFunction: FetchFunction = browserFetch) {
  return sendPromptRequest(fetchFunction, `${PROMPTS_ENDPOINT}/${encodeURIComponent(id)}`, { method: "DELETE" });
}

export function toSaveResult(result: PromptRequestResult): SaveResult {
  if (result.ok) {
    return { ok: true };
  }
  if (result.kind === "not_found") {
    return { ok: false, message: DELETED_PROMPT_MESSAGE, retryable: false };
  }
  return { ok: false, message: result.message, retryable: result.kind === "network" || result.kind === "server" };
}
