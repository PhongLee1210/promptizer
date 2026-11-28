import { browser } from "wxt/browser";
import { accountSession, API_ORIGIN } from "../account/account-session.ts";
import { createPromptClient } from "../prompts/prompt-client.ts";
import {
  createDeletePromptHandler,
  createSavePromptHandler,
  createUpdatePromptHandler,
} from "../prompts/save-prompt-handler.ts";
import {
  isDeletePromptMessage,
  isSavePromptMessage,
  isUpdatePromptMessage,
  pickPromptEdit,
} from "../prompts/save-prompt-message.ts";
import type { PromptDeleteResponse, PromptWriteResponse } from "../prompts/save-prompt-message.ts";

const promptClient = createPromptClient(API_ORIGIN);
const getAccessToken = () => accountSession.getAccessToken();
const handleSavePrompt = createSavePromptHandler(getAccessToken, promptClient);
const handleUpdatePrompt = createUpdatePromptHandler(getAccessToken, promptClient);
const handleDeletePrompt = createDeletePromptHandler(getAccessToken, promptClient);

function handlePromptWrite(message: unknown): Promise<PromptWriteResponse | PromptDeleteResponse> | undefined {
  if (isSavePromptMessage(message)) {
    return handleSavePrompt(message.draft);
  }
  if (isUpdatePromptMessage(message)) {
    return handleUpdatePrompt(message.id, pickPromptEdit(message.changes));
  }
  if (isDeletePromptMessage(message)) {
    return handleDeletePrompt(message.id);
  }
  return undefined;
}

export default defineBackground(() => {
  browser.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    const pending = handlePromptWrite(message);
    if (pending === undefined) {
      return undefined;
    }
    void pending.then(sendResponse);
    return true;
  });
});
