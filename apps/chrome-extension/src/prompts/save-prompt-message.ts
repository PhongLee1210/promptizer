import type { Prompt } from "@promptizer/shared";

export const SAVE_PROMPT_MESSAGE_TYPE = "promptizer:save-prompt";

export interface SavePromptMessage {
  type: typeof SAVE_PROMPT_MESSAGE_TYPE;
  draft: { title: string; text: string };
}

export type SavePromptResponse =
  { ok: true; prompt: Prompt } | { ok: false; kind: "unauthenticated" | "retryable" | "validation"; message: string };

export function isSavePromptMessage(value: unknown): value is SavePromptMessage {
  return typeof value === "object" && value !== null && (value as { type?: unknown }).type === SAVE_PROMPT_MESSAGE_TYPE;
}
