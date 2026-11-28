import { CLIENT_KIND_HEADER, EXTENSION_CLIENT_KIND } from "@promptizer/shared";
import type { ApiErrorBody, Prompt, PromptDraft, PromptFieldErrors } from "@promptizer/shared";

export type PromptClientError =
  | { kind: "unauthenticated" | "retryable"; message: string }
  | { kind: "validation"; message: string; fields: PromptFieldErrors };

export type PromptClientResult<Value> = { ok: true; value: Value } | { ok: false; error: PromptClientError };

export interface PromptClient {
  createPrompt(accessToken: string, draft: PromptDraft): Promise<PromptClientResult<Prompt>>;
}

const RETRYABLE_ERROR: PromptClientError = {
  kind: "retryable",
  message: "Couldn't reach Promptizer. Check your connection and try again.",
};

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
  return {
    async createPrompt(accessToken, draft) {
      let response: Response;
      try {
        response = await fetchImplementation(`${apiOrigin}/api/prompts`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
            [CLIENT_KIND_HEADER]: EXTENSION_CLIENT_KIND,
          },
          body: JSON.stringify(draft),
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
    },
  };
}
