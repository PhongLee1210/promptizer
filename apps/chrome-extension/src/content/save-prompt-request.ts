import { browser } from "wxt/browser";
import { SAVE_PROMPT_MESSAGE_TYPE } from "../prompts/save-prompt-message.ts";
import type { SavePromptMessage, SavePromptResponse } from "../prompts/save-prompt-message.ts";

export async function requestSavePrompt(draft: { title: string; text: string }): Promise<SavePromptResponse> {
  const message: SavePromptMessage = { type: SAVE_PROMPT_MESSAGE_TYPE, draft };
  try {
    return (await browser.runtime.sendMessage(message)) as SavePromptResponse;
  } catch {
    return { ok: false, kind: "retryable", message: "Couldn't reach Promptizer. Check your connection and try again." };
  }
}
