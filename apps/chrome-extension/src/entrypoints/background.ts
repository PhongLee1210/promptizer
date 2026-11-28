import { browser } from "wxt/browser";
import { accountSession, API_ORIGIN } from "../account/account-session.ts";
import { createPromptClient } from "../prompts/prompt-client.ts";
import { createSavePromptHandler } from "../prompts/save-prompt-handler.ts";
import { isSavePromptMessage } from "../prompts/save-prompt-message.ts";

const handleSavePrompt = createSavePromptHandler(() => accountSession.getAccessToken(), createPromptClient(API_ORIGIN));

export default defineBackground(() => {
  browser.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (!isSavePromptMessage(message)) {
      return undefined;
    }
    void handleSavePrompt(message.draft).then(sendResponse);
    return true;
  });
});
