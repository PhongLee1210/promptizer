import type { Prompt, PromptFieldErrors } from "@promptizer/shared";

export const SAVE_PROMPT_MESSAGE_TYPE = "promptizer:save-prompt";
export const UPDATE_PROMPT_MESSAGE_TYPE = "promptizer:update-prompt";

export interface SavePromptMessage {
  type: typeof SAVE_PROMPT_MESSAGE_TYPE;
  draft: { title: string; text: string };
}

export interface PromptEdit {
  title?: string;
  text?: string;
}

export interface UpdatePromptMessage {
  type: typeof UPDATE_PROMPT_MESSAGE_TYPE;
  id: string;
  changes: PromptEdit;
}

export type PromptWriteResponse =
  | { ok: true; prompt: Prompt }
  | { ok: false; kind: "unauthenticated" | "retryable" | "not_found"; message: string }
  | { ok: false; kind: "validation"; message: string; fields: PromptFieldErrors };

function hasMessageType(value: unknown, type: string): boolean {
  return typeof value === "object" && value !== null && (value as { type?: unknown }).type === type;
}

export function isSavePromptMessage(value: unknown): value is SavePromptMessage {
  return hasMessageType(value, SAVE_PROMPT_MESSAGE_TYPE);
}

export function isUpdatePromptMessage(value: unknown): value is UpdatePromptMessage {
  return hasMessageType(value, UPDATE_PROMPT_MESSAGE_TYPE);
}
