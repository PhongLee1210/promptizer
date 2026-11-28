import { browser } from "wxt/browser";
import { createLibraryCache, replaceCachedPrompt } from "../library/library-cache.ts";
import { createBrowserSnapshotStore } from "../library/snapshot-store.ts";
import { SAVE_PROMPT_MESSAGE_TYPE, UPDATE_PROMPT_MESSAGE_TYPE } from "../prompts/save-prompt-message.ts";
import type {
  PromptEdit,
  PromptWriteResponse,
  SavePromptMessage,
  UpdatePromptMessage,
} from "../prompts/save-prompt-message.ts";

const UNREACHABLE_RESPONSE: PromptWriteResponse = {
  ok: false,
  kind: "retryable",
  message: "Couldn't reach Promptizer. Check your connection and try again.",
};

async function sendPromptWrite(message: SavePromptMessage | UpdatePromptMessage): Promise<PromptWriteResponse> {
  try {
    return ((await browser.runtime.sendMessage(message)) as PromptWriteResponse | undefined) ?? UNREACHABLE_RESPONSE;
  } catch {
    return UNREACHABLE_RESPONSE;
  }
}

export function requestSavePrompt(draft: { title: string; text: string }): Promise<PromptWriteResponse> {
  return sendPromptWrite({ type: SAVE_PROMPT_MESSAGE_TYPE, draft });
}

export async function pushPromptEdit(id: string, changes: PromptEdit): Promise<PromptWriteResponse> {
  const response = await sendPromptWrite({ type: UPDATE_PROMPT_MESSAGE_TYPE, id, changes });
  if (response.ok) {
    await replaceCachedPrompt(createLibraryCache(createBrowserSnapshotStore()), response.prompt);
  }
  return response;
}
