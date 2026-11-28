import type { AuthClientResult } from "../account/auth-client.ts";
import type { PromptClient, PromptClientResult } from "./prompt-client.ts";
import type { PromptEdit, PromptWriteResponse } from "./save-prompt-message.ts";
import type { Prompt } from "@promptizer/shared";

type AccessTokenSource = () => Promise<AuthClientResult<string | undefined>>;

async function writeWithAccessToken(
  getAccessToken: AccessTokenSource,
  write: (accessToken: string) => Promise<PromptClientResult<Prompt>>,
): Promise<PromptWriteResponse> {
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
  const written = await write(token.value);
  if (written.ok) {
    return { ok: true, prompt: written.value };
  }
  if (written.error.kind === "validation") {
    return { ok: false, kind: "validation", message: written.error.message, fields: written.error.fields };
  }
  return { ok: false, kind: written.error.kind, message: written.error.message };
}

export function createSavePromptHandler(
  getAccessToken: AccessTokenSource,
  promptClient: PromptClient,
): (draft: { title: string; text: string }) => Promise<PromptWriteResponse> {
  return function handleSavePrompt(draft) {
    return writeWithAccessToken(getAccessToken, (accessToken) => promptClient.createPrompt(accessToken, draft));
  };
}

export function createUpdatePromptHandler(
  getAccessToken: AccessTokenSource,
  promptClient: PromptClient,
): (id: string, changes: PromptEdit) => Promise<PromptWriteResponse> {
  return function handleUpdatePrompt(id, changes) {
    return writeWithAccessToken(getAccessToken, (accessToken) => promptClient.updatePrompt(accessToken, id, changes));
  };
}
