import type { AuthClientResult } from "../account/auth-client.ts";
import type { PromptClient, PromptClientResult } from "./prompt-client.ts";
import type {
  PromptDeleteResponse,
  PromptEdit,
  PromptWriteFailure,
  PromptWriteResponse,
} from "./save-prompt-message.ts";
import type { Prompt } from "@promptizer/shared";

type AccessTokenSource = () => Promise<AuthClientResult<string | undefined>>;

async function sendWithAccessToken<Value>(
  getAccessToken: AccessTokenSource,
  send: (accessToken: string) => Promise<PromptClientResult<Value>>,
): Promise<{ ok: true; value: Value } | PromptWriteFailure> {
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
  const sent = await send(token.value);
  if (sent.ok) {
    return sent;
  }
  if (sent.error.kind === "validation") {
    return { ok: false, kind: "validation", message: sent.error.message, fields: sent.error.fields };
  }
  return { ok: false, kind: sent.error.kind, message: sent.error.message };
}

async function writeWithAccessToken(
  getAccessToken: AccessTokenSource,
  write: (accessToken: string) => Promise<PromptClientResult<Prompt>>,
): Promise<PromptWriteResponse> {
  const written = await sendWithAccessToken(getAccessToken, write);
  return written.ok ? { ok: true, prompt: written.value } : written;
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

export function createDeletePromptHandler(
  getAccessToken: AccessTokenSource,
  promptClient: PromptClient,
): (id: string) => Promise<PromptDeleteResponse> {
  return async function handleDeletePrompt(id) {
    const deleted = await sendWithAccessToken(getAccessToken, (accessToken) =>
      promptClient.deletePrompt(accessToken, id),
    );
    return deleted.ok ? { ok: true } : deleted;
  };
}
