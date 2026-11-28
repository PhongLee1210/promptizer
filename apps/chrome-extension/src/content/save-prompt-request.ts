import { browser } from "wxt/browser";
import { hasStoredSession } from "../account/session-store.ts";
import { createLibraryCache, removeCachedPrompt, replaceCachedPrompt } from "../library/library-cache.ts";
import type { LibraryCache } from "../library/library-cache.ts";
import { createBrowserSnapshotStore } from "../library/snapshot-store.ts";
import {
  DELETE_PROMPT_MESSAGE_TYPE,
  SAVE_PROMPT_MESSAGE_TYPE,
  UPDATE_PROMPT_MESSAGE_TYPE,
} from "../prompts/save-prompt-message.ts";
import type {
  DeletePromptMessage,
  PromptDeleteResponse,
  PromptEdit,
  PromptWriteFailure,
  PromptWriteResponse,
  SavePromptMessage,
  UpdatePromptMessage,
} from "../prompts/save-prompt-message.ts";

const UNREACHABLE_RESPONSE: PromptWriteFailure = {
  ok: false,
  kind: "retryable",
  message: "Couldn't reach Promptizer. Check your connection and try again.",
};

type CacheOwnershipCheck = () => Promise<boolean>;

async function sendPromptWrite<Reply extends PromptWriteResponse | PromptDeleteResponse>(
  message: SavePromptMessage | UpdatePromptMessage | DeletePromptMessage,
): Promise<Reply | PromptWriteFailure> {
  try {
    return ((await browser.runtime.sendMessage(message)) as Reply | undefined) ?? UNREACHABLE_RESPONSE;
  } catch {
    return UNREACHABLE_RESPONSE;
  }
}

async function writeCacheWhileSignedIn(
  isSameAccountSignedIn: CacheOwnershipCheck,
  write: (cache: LibraryCache) => Promise<unknown>,
): Promise<void> {
  if (!(await isSameAccountSignedIn())) {
    return;
  }
  const cache = createLibraryCache(createBrowserSnapshotStore());
  await write(cache);
  if (!(await isSameAccountSignedIn())) {
    await cache.clear();
  }
}

export function requestSavePrompt(draft: { title: string; text: string }): Promise<PromptWriteResponse> {
  return sendPromptWrite({ type: SAVE_PROMPT_MESSAGE_TYPE, draft });
}

export async function pushPromptEdit(
  id: string,
  changes: PromptEdit,
  isSameAccountSignedIn: CacheOwnershipCheck = hasStoredSession,
): Promise<PromptWriteResponse> {
  const response = await sendPromptWrite<PromptWriteResponse>({ type: UPDATE_PROMPT_MESSAGE_TYPE, id, changes });
  if (response.ok) {
    await writeCacheWhileSignedIn(isSameAccountSignedIn, (cache) => replaceCachedPrompt(cache, response.prompt));
  }
  return response;
}

export async function pushPromptDelete(
  id: string,
  isSameAccountSignedIn: CacheOwnershipCheck = hasStoredSession,
): Promise<PromptDeleteResponse> {
  const response = await sendPromptWrite<PromptDeleteResponse>({ type: DELETE_PROMPT_MESSAGE_TYPE, id });
  const isGoneFromAccount = response.ok || response.kind === "not_found";
  if (!isGoneFromAccount) {
    return response;
  }
  await writeCacheWhileSignedIn(isSameAccountSignedIn, (cache) => removeCachedPrompt(cache, id));
  return { ok: true };
}
