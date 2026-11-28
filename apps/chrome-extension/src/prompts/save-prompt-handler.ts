import type { AuthClientResult } from "../account/auth-client.ts";
import type { PromptClient } from "./prompt-client.ts";
import type { SavePromptResponse } from "./save-prompt-message.ts";

export function createSavePromptHandler(
  getAccessToken: () => Promise<AuthClientResult<string | undefined>>,
  promptClient: PromptClient,
): (draft: { title: string; text: string }) => Promise<SavePromptResponse> {
  return async function handleSavePrompt(draft): Promise<SavePromptResponse> {
    const token = await getAccessToken();
    if (!token.ok) {
      return {
        ok: false,
        kind: token.error.kind === "unauthenticated" ? "unauthenticated" : "retryable",
        message: token.error.message,
      };
    }
    if (token.value === undefined) {
      return { ok: false, kind: "unauthenticated", message: "Please sign in again." };
    }
    const created = await promptClient.createPrompt(token.value, draft);
    if (!created.ok) {
      return { ok: false, kind: created.error.kind, message: created.error.message };
    }
    return { ok: true, prompt: created.value };
  };
}
