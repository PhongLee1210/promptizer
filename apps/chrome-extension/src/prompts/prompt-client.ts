import { CLIENT_KIND_HEADER, EXTENSION_CLIENT_KIND } from "@promptizer/shared";
import type { ApiErrorBody, Prompt, PromptChanges, PromptDraft, PromptFieldErrors } from "@promptizer/shared";

export type PromptClientError =
  | { kind: "unauthenticated" | "retryable" | "not_found" | "rejected"; message: string }
  | { kind: "validation"; message: string; fields: PromptFieldErrors };

export type PromptClientResult<Value> = { ok: true; value: Value } | { ok: false; error: PromptClientError };

export interface PromptClient {
  createPrompt(accessToken: string, draft: PromptDraft): Promise<PromptClientResult<Prompt>>;
  updatePrompt(accessToken: string, id: string, changes: PromptChanges): Promise<PromptClientResult<Prompt>>;
  deletePrompt(accessToken: string, id: string): Promise<PromptClientResult<null>>;
}

const RETRYABLE_ERROR: PromptClientError = {
  kind: "retryable",
  message: "Couldn't reach Promptizer. Check your connection and try again.",
};

const REJECTED_MESSAGE = "Promptizer couldn't accept this change. Your text is still here.";

const UNREADABLE_REPLY_ERROR: PromptClientError = {
  kind: "rejected",
  message:
    "Promptizer answered, but the reply couldn't be read, so this change may already be saved. Check the dashboard before trying again.",
};

const TEMPORARY_CLIENT_ERROR_STATUSES = new Set([408, 429]);

const NOT_FOUND_MESSAGE =
  "This prompt was deleted elsewhere, so it can't be saved. Copy your text if you still need it.";

function mapFailure(status: number, body: ApiErrorBody | undefined, targetsExistingPrompt: boolean): PromptClientError {
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
  if (targetsExistingPrompt && (status === 404 || body?.code === "not_found")) {
    return { kind: "not_found", message: NOT_FOUND_MESSAGE };
  }
  if (status >= 400 && status < 500 && !TEMPORARY_CLIENT_ERROR_STATUSES.has(status)) {
    return { kind: "rejected", message: body?.message || REJECTED_MESSAGE };
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
  async function sendPromptRequest(
    method: "POST" | "PATCH" | "DELETE",
    path: string,
    accessToken: string,
    payload?: PromptDraft | PromptChanges,
  ): Promise<PromptClientResult<Response>> {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${accessToken}`,
      [CLIENT_KIND_HEADER]: EXTENSION_CLIENT_KIND,
    };
    if (payload !== undefined) {
      headers["Content-Type"] = "application/json";
    }
    let response: Response;
    try {
      response = await fetchImplementation(`${apiOrigin}${path}`, {
        method,
        headers,
        body: payload === undefined ? undefined : JSON.stringify(payload),
      });
    } catch {
      return { ok: false, error: RETRYABLE_ERROR };
    }
    if (!response.ok) {
      return { ok: false, error: mapFailure(response.status, await readErrorBody(response), method !== "POST") };
    }
    return { ok: true, value: response };
  }

  async function sendPromptWrite(
    method: "POST" | "PATCH",
    path: string,
    accessToken: string,
    payload: PromptDraft | PromptChanges,
  ): Promise<PromptClientResult<Prompt>> {
    const sent = await sendPromptRequest(method, path, accessToken, payload);
    if (!sent.ok) {
      return sent;
    }
    try {
      return { ok: true, value: (await sent.value.json()) as Prompt };
    } catch {
      return { ok: false, error: UNREADABLE_REPLY_ERROR };
    }
  }

  function promptPath(id: string): string {
    return `/api/prompts/${encodeURIComponent(id)}`;
  }

  return {
    createPrompt(accessToken, draft) {
      return sendPromptWrite("POST", "/api/prompts", accessToken, draft);
    },
    updatePrompt(accessToken, id, changes) {
      return sendPromptWrite("PATCH", promptPath(id), accessToken, changes);
    },
    async deletePrompt(accessToken, id) {
      const sent = await sendPromptRequest("DELETE", promptPath(id), accessToken);
      return sent.ok ? { ok: true, value: null } : sent;
    },
  };
}
