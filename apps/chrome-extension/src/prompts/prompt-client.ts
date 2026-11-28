import { CLIENT_KIND_HEADER, EXTENSION_CLIENT_KIND } from "@promptizer/shared";
import type { ApiErrorBody, Prompt, PromptChanges, PromptDraft, PromptFieldErrors } from "@promptizer/shared";

export type PromptClientError =
  | { kind: "unauthenticated" | "retryable" | "not_found"; message: string }
  | { kind: "validation"; message: string; fields: PromptFieldErrors };

export type PromptClientResult<Value> = { ok: true; value: Value } | { ok: false; error: PromptClientError };

export interface PromptClient {
  createPrompt(accessToken: string, draft: PromptDraft): Promise<PromptClientResult<Prompt>>;
  updatePrompt(accessToken: string, id: string, changes: PromptChanges): Promise<PromptClientResult<Prompt>>;
}

const RETRYABLE_ERROR: PromptClientError = {
  kind: "retryable",
  message: "Couldn't reach Promptizer. Check your connection and try again.",
};

const NOT_FOUND_MESSAGE = "This prompt is no longer in your account. Refresh your library.";

function mapFailure(status: number, body: ApiErrorBody | undefined): PromptClientError {
  if (status === 401 || body?.code === "unauthenticated") {
    return { kind: "unauthenticated", message: body?.message ?? "Please sign in again." };
  }
  if (status === 422 || body?.code === "validation_failed") {
    return {
      kind: "validation",
      message: body?.message ?? "Please fix the highlighted fields.",
      fields: body?.fields ?? {},
    };
  }
  if (status === 404 || body?.code === "not_found") {
    return { kind: "not_found", message: NOT_FOUND_MESSAGE };
  }
  return RETRYABLE_ERROR;
}

async function readErrorBody(response: Response): Promise<ApiErrorBody | undefined> {
  try {
    return (await response.json()) as ApiErrorBody;
  } catch {
    return undefined;
  }
}

export function createPromptClient(apiOrigin: string, fetchImplementation: typeof fetch = fetch): PromptClient {
  async function sendPromptWrite(
    method: "POST" | "PATCH",
    path: string,
    accessToken: string,
    payload: PromptDraft | PromptChanges,
  ): Promise<PromptClientResult<Prompt>> {
    let response: Response;
    try {
      response = await fetchImplementation(`${apiOrigin}${path}`, {
        method,
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
          [CLIENT_KIND_HEADER]: EXTENSION_CLIENT_KIND,
        },
        body: JSON.stringify(payload),
      });
    } catch {
      return { ok: false, error: RETRYABLE_ERROR };
    }
    if (!response.ok) {
      return { ok: false, error: mapFailure(response.status, await readErrorBody(response)) };
    }
    try {
      return { ok: true, value: (await response.json()) as Prompt };
    } catch {
      return { ok: false, error: RETRYABLE_ERROR };
    }
  }

  return {
    createPrompt(accessToken, draft) {
      return sendPromptWrite("POST", "/api/prompts", accessToken, draft);
    },
    updatePrompt(accessToken, id, changes) {
      return sendPromptWrite("PATCH", `/api/prompts/${encodeURIComponent(id)}`, accessToken, changes);
    },
  };
}
